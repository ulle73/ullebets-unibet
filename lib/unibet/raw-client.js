import fs from "node:fs/promises";
import path from "node:path";

const EVENT_BASE_URL = "https://eu1.offering-api.kambicdn.com/offering/v2018/ubse/betoffer/event";
const UNIBET_EVENT_BASE_URL = "https://www.unibet.se/betting/sports/event";
const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
  Referer: "https://www.unibet.se/",
  "X-Requested-With": "XMLHttpRequest",
};
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

let configPromise;
let aliasPromise;

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(process.cwd(), file), "utf8"));
}

async function leagueConfig() {
  if (!configPromise) configPromise = readJson("data/unibetLeagueUrls.json");
  return configPromise;
}

async function aliases() {
  if (!aliasPromise) aliasPromise = readJson("data/teamNameAliases.json");
  return aliasPromise;
}

function normalizeTeamName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, "and")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLeagueName(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/\d{4}\/\d{2}|\d{2}\/\d{2}/g, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveAlias(name, aliasMap) {
  const normalized = normalizeTeamName(name);
  if (!normalized) return null;
  if (aliasMap.has(normalized)) return aliasMap.get(normalized);
  const cleaned = normalized.replace(/\b(?:fc|cf|ac|afc|club|the)\b/g, "").replace(/\s+/g, " ").trim();
  return aliasMap.get(cleaned) || null;
}

function buildAliasMap(rawAliases) {
  const map = new Map();
  const add = (alias, canonical) => {
    const key = normalizeTeamName(alias);
    if (key && !map.has(key)) map.set(key, canonical);
  };
  for (const [canonical, list] of Object.entries(rawAliases || {})) {
    add(canonical, canonical);
    for (const alias of list || []) add(alias, canonical);
  }
  return map;
}

function normalizeLeagueLookupValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase()
    .trim();
}

function leagueMatches(leagueName, configuredName, configured) {
  if (!leagueName) return false;
  const wanted = normalizeLeagueLookupValue(leagueName);
  if (!wanted) return false;
  const candidates = [configuredName, configured?.leagueSlug, ...(configured?.lookupSlugs || [])]
    .map(normalizeLeagueLookupValue)
    .filter(Boolean);
  return candidates.includes(wanted) || candidates.some((candidate) => wanted.includes(candidate) || candidate.includes(wanted));
}

function buildListViewUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", "sv_SE");
  url.searchParams.set("market", "SE");
  url.searchParams.set("client_id", "2");
  url.searchParams.set("channel_id", "1");
  url.searchParams.set("useCombined", "true");
  url.searchParams.set("ncid", Date.now().toString());
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { rawText: text };
  }
  return {
    request_url: url,
    response_status: response.status,
    response_headers: Object.fromEntries(response.headers.entries()),
    payload,
  };
}

function toEvent(entry) {
  if (!entry || typeof entry !== "object") return null;
  return entry.event && typeof entry.event === "object" ? entry.event : entry;
}

function parseEventStart(event) {
  if (!event?.start) return null;
  const date = new Date(event.start);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function targetTime(match) {
  const raw = match.start_time || match.start || match.timestamp || match.kickoff;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function scoreEvent(event, match, aliasMap) {
  const targetHome = normalizeTeamName(resolveAlias(match.home_team || match.homeTeam || match.homeTeamName, aliasMap) || match.home_team || match.homeTeam || match.homeTeamName);
  const targetAway = normalizeTeamName(resolveAlias(match.away_team || match.awayTeam || match.awayTeamName, aliasMap) || match.away_team || match.awayTeam || match.awayTeamName);
  const eventHome = normalizeTeamName(resolveAlias(event.homeName, aliasMap) || event.homeName);
  const eventAway = normalizeTeamName(resolveAlias(event.awayName, aliasMap) || event.awayName);

  const exact = eventHome === targetHome && eventAway === targetAway;
  const swapped = eventHome === targetAway && eventAway === targetHome;
  if (!exact && !swapped) return null;

  const target = targetTime(match);
  const start = parseEventStart(event);
  const diffMs = target && start ? Math.abs(start - target) : null;
  if (diffMs !== null && diffMs > SIX_HOURS_MS) return null;

  let score = exact ? 10 : 6;
  if (diffMs !== null) score += Math.max(0, SIX_HOURS_MS - diffMs) / (60 * 60 * 1000);
  return { event, score, diffMs };
}

async function findEventForMatch(match) {
  const configs = await leagueConfig();
  const aliasMap = buildAliasMap(await aliases());
  const entries = Object.entries(configs);
  const preferred = entries.filter(([name, conf]) => leagueMatches(match.league_name || match.league_key, name, conf));
  const searchEntries = preferred.length ? preferred : entries;
  const candidates = [];

  for (const [configuredName, conf] of searchEntries) {
    if (!conf?.baseUrl) continue;
    const listUrl = buildListViewUrl(conf.baseUrl);
    const listResponse = await fetchJson(listUrl);
    if (listResponse.response_status < 200 || listResponse.response_status >= 300) continue;
    const events = (listResponse.payload?.events || []).map(toEvent).filter((e) => e?.id && e.homeName && e.awayName);
    for (const event of events) {
      const scored = scoreEvent(event, match, aliasMap);
      if (scored) candidates.push({ ...scored, configuredName, listUrl, listPayload: listResponse.payload });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

export async function fetchRawUnibetOddsForMatch(match) {
  const found = await findEventForMatch(match);
  if (!found) {
    throw new Error(`No Unibet event match for ${match.home_team} - ${match.away_team} (${match.league_name || match.league_key})`);
  }

  const eventId = String(found.event.id);
  const oddsUrl = `${EVENT_BASE_URL}/${eventId}.json?lang=sv_SE&market=SE&client_id=2&channel_id=1&includeParticipants=true`;
  const oddsResponse = await fetchJson(oddsUrl);

  return {
    eventId,
    eventUrl: `${UNIBET_EVENT_BASE_URL}/${eventId}`,
    matched: {
      configuredLeague: found.configuredName,
      home: found.event.homeName,
      away: found.event.awayName,
      start: found.event.start || null,
      score: found.score,
      diffMs: found.diffMs,
    },
    listView: {
      request_url: found.listUrl,
      payload: found.listPayload,
    },
    odds: oddsResponse,
  };
}
