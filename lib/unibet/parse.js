function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getFirst(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return undefined;
}

function findEventArrays(payload) {
  const arrays = [];

  function walk(value, path = []) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      const key = String(path.at(-1) || "").toLowerCase();
      if (["events", "matches", "fixtures"].includes(key)) arrays.push(value);
      for (const item of value) walk(item, path);
      return;
    }
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  }

  walk(payload);
  return arrays;
}

function parseStartTime(event) {
  const raw = getFirst(event, ["startTime", "start_time", "startsAt", "start", "eventStart", "eventStartTime", "kickoff"]);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTeams(event) {
  const home = getFirst(event, ["homeTeamName", "homeName", "home", "homeTeam"]);
  const away = getFirst(event, ["awayTeamName", "awayName", "away", "awayTeam"]);

  if (typeof home === "string" && typeof away === "string") return { home_team: home, away_team: away };
  if (home?.name && away?.name) return { home_team: home.name, away_team: away.name };

  const participants = asArray(event.participants || event.competitors || event.teams);
  if (participants.length >= 2) {
    const maybeHome = participants.find((p) => p.home === true || p.type === "home") || participants[0];
    const maybeAway = participants.find((p) => p.home === false || p.type === "away") || participants[1];
    return {
      home_team: maybeHome.name || maybeHome.participantName || maybeHome.label,
      away_team: maybeAway.name || maybeAway.participantName || maybeAway.label,
    };
  }

  const name = event.name || event.eventName || event.label;
  if (typeof name === "string" && name.includes(" - ")) {
    const [homeName, awayName] = name.split(" - ");
    return { home_team: homeName?.trim(), away_team: awayName?.trim() };
  }

  return { home_team: null, away_team: null };
}

export function parseUnibetEvents(payload, league) {
  const candidateArrays = findEventArrays(payload);
  const events = [];
  const seen = new Set();

  for (const arr of candidateArrays) {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;

      const source_event_id = String(getFirst(item, ["id", "eventId", "event_id", "externalId"]) || "");
      const start_time = parseStartTime(item);
      const teams = parseTeams(item);

      if (!source_event_id || !start_time || !teams.home_team || !teams.away_team) continue;
      if (seen.has(source_event_id)) continue;
      seen.add(source_event_id);

      events.push({
        source: "unibet",
        source_event_id,
        league_key: league.key || league.league_key || league.league_name,
        league_name: league.league_name || league.name,
        sport: league.sport || "football",
        home_team: teams.home_team,
        away_team: teams.away_team,
        start_time,
        odds_url: item.oddsUrl || item.url || item.links?.odds || null,
        raw_event: item,
      });
    }
  }

  return events;
}

export function detectMarketCoverage(payload) {
  const text = JSON.stringify(payload).toLowerCase();
  return {
    has_shots: /\bshots?\b|skott/.test(text),
    has_shots_on_target: /shots? on target|target shots?|skott på mål|sot/.test(text),
    has_corners: /corners?|hörnor|corner/.test(text),
    has_halves: /1st half|first half|2nd half|second half|halvlek/.test(text),
  };
}
