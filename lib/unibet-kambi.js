import fs from "node:fs/promises";
import path from "node:path";

import { resolveLegacyRepoRoot } from "./config.js";

const LIST_VIEW_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  Referer: "https://www.unibet.se/",
  "X-Requested-With": "XMLHttpRequest",
};

const EVENT_BASE_URL = "https://eu1.offering-api.kambicdn.com/offering/v2018/ubse/betoffer/event";

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/\b(?:fc|cf|ac|afc|club|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLeagueLookupValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase()
    .trim();
}

function buildLeagueLookupSlugs(leagueName) {
  if (!leagueName) return [];
  const trimmed = String(leagueName).trim();
  if (!trimmed) return [];

  const candidates = new Set([
    trimmed,
    trimmed.replace(/\s+/g, ""),
    trimmed.replace(/\s+/g, "_"),
    trimmed.replace(/[^\w\s]+/g, ""),
  ]);

  return Array.from(candidates)
    .map((value) => normalizeLeagueLookupValue(value))
    .filter(Boolean);
}

function withinKickoffWindow(matchKickoffAt, eventStart) {
  const matchTs = Date.parse(matchKickoffAt);
  const eventTs = Date.parse(eventStart);
  if (!Number.isFinite(matchTs) || !Number.isFinite(eventTs)) {
    return true;
  }
  return Math.abs(matchTs - eventTs) <= 18 * 60 * 60 * 1000;
}

export async function loadLeagueConfig(cwd = process.cwd(), env = process.env) {
  const searchPaths = [
    path.join(cwd, "data", "unibetLeagueUrls.json"),
    path.join(resolveLegacyRepoRoot(env, cwd), "data", "unibetLeagueUrls.json"),
  ];

  for (const candidate of searchPaths) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      return { path: candidate, config: JSON.parse(raw) };
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error("Could not locate unibetLeagueUrls.json in local repo or legacy repo");
}

export function findLeagueConfig(config, leagueName) {
  if (!leagueName) return null;

  if (config[leagueName]) {
    return config[leagueName];
  }

  const lookupSet = new Set(buildLeagueLookupSlugs(leagueName));
  if (!lookupSet.size) return null;

  for (const [name, entry] of Object.entries(config)) {
    const candidates = new Set([
      normalizeLeagueLookupValue(name),
      normalizeLeagueLookupValue(entry?.leagueSlug),
      ...((entry?.lookupSlugs || []).map((slug) => normalizeLeagueLookupValue(slug))),
    ]);

    for (const candidate of candidates) {
      if (candidate && lookupSet.has(candidate)) {
        return entry;
      }
    }
  }

  return null;
}

export function selectLeagueConfigs(config, leagueName) {
  const direct = findLeagueConfig(config, leagueName);
  if (direct?.baseUrl) {
    return [direct];
  }

  return Object.values(config).filter((entry) => entry?.baseUrl);
}

export function buildListViewUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", "sv_SE");
  url.searchParams.set("market", "SE");
  url.searchParams.set("client_id", "2");
  url.searchParams.set("channel_id", "1");
  url.searchParams.set("useCombined", "true");
  url.searchParams.set("ncid", Date.now().toString());
  return url.toString();
}

export function buildEventOddsUrl(eventId) {
  const url = new URL(`${EVENT_BASE_URL}/${eventId}.json`);
  url.searchParams.set("lang", "sv_SE");
  url.searchParams.set("market", "SE");
  url.searchParams.set("client_id", "2");
  url.searchParams.set("channel_id", "3");
  url.searchParams.set("includeParticipants", "true");
  url.searchParams.set("ncid", Date.now().toString());
  return url.toString();
}

export async function fetchLeagueEvents(baseUrl) {
  const response = await fetch(buildListViewUrl(baseUrl), {
    headers: LIST_VIEW_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`List view request failed with status ${response.status}`);
  }

  const data = await response.json();
  return (Array.isArray(data?.events) ? data.events : [])
    .map((entry) => entry?.event || entry)
    .filter((event) => event?.id && event?.homeName && event?.awayName);
}

export async function fetchEventOdds(eventId) {
  const response = await fetch(buildEventOddsUrl(eventId), {
    headers: LIST_VIEW_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Event odds request failed with status ${response.status}`);
  }

  return response.json();
}

export function findBestMatchingEvent(events, match) {
  const targetHome = normalizeName(match.homeTeamName);
  const targetAway = normalizeName(match.awayTeamName);

  const candidates = events.filter((event) => {
    const eventHome = normalizeName(event.homeName);
    const eventAway = normalizeName(event.awayName);
    return (
      eventHome === targetHome &&
      eventAway === targetAway &&
      withinKickoffWindow(match.kickoffAt, event.start)
    );
  });

  if (!candidates.length) {
    return null;
  }

  return candidates
    .slice()
    .sort((left, right) => {
      const leftDiff = Math.abs(Date.parse(left.start || 0) - Date.parse(match.kickoffAt || 0));
      const rightDiff = Math.abs(Date.parse(right.start || 0) - Date.parse(match.kickoffAt || 0));
      return leftDiff - rightDiff;
    })[0];
}
