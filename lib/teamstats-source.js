export const TEAMSTATS_MATCH_PROJECTION = {
  _importMeta: 1,
  "full.matchId": 1,
  "full.timestamp": 1,
  "full.date": 1,
  "full.savedAt": 1,
  "full.homeTeamId": 1,
  "full.homeTeamName": 1,
  "full.awayTeamId": 1,
  "full.awayTeamName": 1,
  "full.tournament": 1,
  "full.season": 1,
  "full.leagueName": 1,
  "full.matchDetails.tournament.name": 1,
  "full.matchDetails.league.name": 1,
  "full.matchDetails.season.name": 1,
};

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toIsoTimestamp(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1e12 ? numeric : numeric * 1000;
      return new Date(millis).toISOString();
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return null;
}

function inferKickoffAt(row) {
  return (
    toIsoTimestamp(row?.timestamp) ||
    toIsoTimestamp(row?.savedAt) ||
    (row?.date ? `${row.date}T00:00:00.000Z` : null)
  );
}

function inferLeagueName(row) {
  return (
    row?.leagueName ||
    row?.tournament ||
    row?.matchDetails?.tournament?.name ||
    row?.matchDetails?.league?.name ||
    null
  );
}

function inferSeasonName(row) {
  return row?.season || row?.matchDetails?.season?.name || null;
}

function buildSourceMatchKey(row) {
  return [
    row.matchId || "",
    row.matchDate || "",
    row.homeTeamName || "",
    row.awayTeamName || "",
  ].join("|");
}

export function expandTeamstatsDocument(document) {
  const rows = Array.isArray(document?.full) ? document.full : [];
  const importedAt = toIsoTimestamp(document?._importMeta?.importedAt);

  return rows
    .map((row) => {
      const kickoffAt = inferKickoffAt(row);
      const matchDate = toIsoDate(row?.date) || (kickoffAt ? kickoffAt.slice(0, 10) : null);
      const matchId = row?.matchId == null ? null : String(row.matchId);

      if (!matchId || !kickoffAt || !row?.homeTeamName || !row?.awayTeamName) {
        return null;
      }

      return {
        matchId,
        kickoffAt,
        matchDate,
        homeTeamId: row?.homeTeamId == null ? null : String(row.homeTeamId),
        homeTeamName: row.homeTeamName,
        awayTeamId: row?.awayTeamId == null ? null : String(row.awayTeamId),
        awayTeamName: row.awayTeamName,
        leagueName: inferLeagueName(row),
        seasonName: inferSeasonName(row),
        sourceTeamId: document?._importMeta?.teamId == null ? null : String(document._importMeta.teamId),
        sourceTeamName: document?._importMeta?.teamName || null,
        sourceTeamRole: document?._importMeta?.teamRole || null,
        sourceDocumentImportedAt: importedAt,
        sourceRowSavedAt: toIsoTimestamp(row?.savedAt),
        sourceFile: document?._importMeta?.sourceFile || null,
      };
    })
    .filter(Boolean);
}

export function collectTeamstatsRows(documents) {
  return documents.flatMap((document) => expandTeamstatsDocument(document));
}

export function buildMatchIndex(rows) {
  const byKey = new Map();

  for (const row of rows) {
    const sourceMatchKey = buildSourceMatchKey(row);
    if (!sourceMatchKey) continue;

    const firstSeenCandidate = row.sourceDocumentImportedAt || row.sourceRowSavedAt || row.kickoffAt;
    const lastSeenCandidate = row.sourceRowSavedAt || row.sourceDocumentImportedAt || row.kickoffAt;

    const existing = byKey.get(sourceMatchKey);
    if (!existing) {
      byKey.set(sourceMatchKey, {
        _id: sourceMatchKey,
        sourceMatchKey,
        matchId: row.matchId,
        kickoffAt: row.kickoffAt,
        matchDate: row.matchDate,
        homeTeamId: row.homeTeamId,
        homeTeamName: row.homeTeamName,
        awayTeamId: row.awayTeamId,
        awayTeamName: row.awayTeamName,
        leagueName: row.leagueName,
        seasonName: row.seasonName,
        firstSeenAt: firstSeenCandidate,
        lastSeenAt: lastSeenCandidate,
        sourceFiles: row.sourceFile ? [row.sourceFile] : [],
      });
      continue;
    }

    if (firstSeenCandidate && (!existing.firstSeenAt || firstSeenCandidate < existing.firstSeenAt)) {
      existing.firstSeenAt = firstSeenCandidate;
    }
    if (lastSeenCandidate && (!existing.lastSeenAt || lastSeenCandidate > existing.lastSeenAt)) {
      existing.lastSeenAt = lastSeenCandidate;
    }
    if (row.sourceFile && !existing.sourceFiles.includes(row.sourceFile)) {
      existing.sourceFiles.push(row.sourceFile);
    }
    if (!existing.leagueName && row.leagueName) {
      existing.leagueName = row.leagueName;
    }
    if (!existing.seasonName && row.seasonName) {
      existing.seasonName = row.seasonName;
    }
  }

  return Array.from(byKey.values()).sort((left, right) =>
    String(left.kickoffAt).localeCompare(String(right.kickoffAt))
  );
}

export function filterMatchesInWindow(matches, options = {}) {
  const now = new Date(options.now || new Date().toISOString());
  const horizonDays = Number.isFinite(options.horizonDays) ? options.horizonDays : 30;
  const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  return matches.filter((match) => {
    const kickoff = new Date(match.kickoffAt);
    if (Number.isNaN(kickoff.getTime())) return false;
    return kickoff >= now && kickoff <= horizon;
  });
}

export function summarizeMatchRows(rows, options = {}) {
  const matches = buildMatchIndex(rows);
  const futureMatches = filterMatchesInWindow(matches, options);
  const kickoffValues = rows
    .map((row) => row.kickoffAt)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return {
    totalRows: rows.length,
    uniqueMatches: matches.length,
    minKickoffAt: kickoffValues[0] ?? null,
    maxKickoffAt: kickoffValues.at(-1) ?? null,
    futureMatchesWithinWindow: futureMatches.length,
  };
}
