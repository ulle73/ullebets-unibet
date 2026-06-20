const DAY_MS = 24 * 60 * 60 * 1000;

function toIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date.toISOString();
}

function shiftIsoDate(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(date.getTime() + days * DAY_MS).toISOString();
}

function matchDayStart(match) {
  if (match?.matchDate) {
    return `${match.matchDate}T00:00:00.000Z`;
  }
  const kickoff = new Date(match.kickoffAt);
  return `${kickoff.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function buildSnapshotJobs(match, importedAt) {
  const firstSeenAt = toIso(importedAt || match.firstSeenAt || new Date().toISOString());
  const kickoffAt = toIso(match.kickoffAt);
  const jobs = [
    { snapshotLabel: "FIRST_SEEN", dueAt: firstSeenAt },
    { snapshotLabel: "T_MINUS_3D", dueAt: shiftIsoDate(kickoffAt, -3) },
    { snapshotLabel: "T_MINUS_2D", dueAt: shiftIsoDate(kickoffAt, -2) },
    { snapshotLabel: "T_MINUS_1D", dueAt: shiftIsoDate(kickoffAt, -1) },
    { snapshotLabel: "MATCH_DAY", dueAt: matchDayStart(match) },
  ];

  return jobs.map((job) => ({
    ...job,
    matchId: match.matchId,
    kickoffAt,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    leagueName: match.leagueName || null,
  }));
}
