function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== "") return obj[key];
  }
  return null;
}

function toDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const ms = value < 10000000000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSourceEventId(match) {
  const id = pickFirst(match, ["matchId", "id", "eventId", "event_id"]);
  if (id != null) return String(id);
  const home = pickFirst(match, ["homeTeamName", "homeName"]);
  const away = pickFirst(match, ["awayTeamName", "awayName"]);
  const time = pickFirst(match, ["startTimestamp", "timestamp", "date", "startTime"]);
  if (home && away && time) return `${home}__${away}__${time}`;
  return null;
}

export function normalizeTeamstatsMatch(match, doc) {
  const source_event_id = parseSourceEventId(match);
  const start_time = toDate(pickFirst(match, ["startTimestamp", "timestamp", "startTime", "date", "kickoff"]));
  const home_team = pickFirst(match, ["homeTeamName", "homeName", "home"]);
  const away_team = pickFirst(match, ["awayTeamName", "awayName", "away"]);
  if (!source_event_id || !start_time || !home_team || !away_team) return null;

  return {
    source: "ullebets_vecel_teamstats",
    source_event_id,
    league_key: String(pickFirst(match, ["leagueKey", "league_id", "tournamentId", "competitionId"]) || "unknown"),
    league_name: pickFirst(match, ["leagueName", "tournamentName", "competitionName"]),
    sport: "football",
    home_team: String(home_team),
    away_team: String(away_team),
    home_team_id: pickFirst(match, ["homeTeamId", "homeId"]),
    away_team_id: pickFirst(match, ["awayTeamId", "awayId"]),
    start_time,
    original_match_id: source_event_id,
    source_collection: "teamstats",
    source_file: doc && doc._importMeta ? doc._importMeta.sourceFile : null,
    source_team_id: doc && doc._importMeta ? doc._importMeta.teamId : null,
    source_team_name: doc && doc._importMeta ? doc._importMeta.teamName : null,
    source_team_role: doc && doc._importMeta ? doc._importMeta.teamRole : null,
    raw_match: match,
  };
}
