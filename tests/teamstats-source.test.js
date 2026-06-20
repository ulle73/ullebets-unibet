import test from "node:test";
import assert from "node:assert/strict";

import {
  TEAMSTATS_MATCH_PROJECTION,
  expandTeamstatsDocument,
  buildMatchIndex,
  summarizeMatchRows,
} from "../lib/teamstats-source.js";

const sourceDocument = {
  _importMeta: {
    sourceFile: "arsenal_home_match_stats.json",
    importedAt: "2026-06-20T10:00:00.000Z",
    teamId: "42",
    teamName: "Arsenal",
    teamRole: "home",
  },
  full: [
    {
      matchId: 101,
      timestamp: 1792605600,
      date: "2026-10-21",
      savedAt: "2026-06-20T10:00:00.000Z",
      homeTeamId: "1",
      homeTeamName: "Arsenal",
      awayTeamId: "2",
      awayTeamName: "Chelsea",
      tournament: "Premier League",
      season: "2026/27",
    },
    {
      matchId: 101,
      timestamp: 1792605600,
      date: "2026-10-21",
      savedAt: "2026-06-20T10:05:00.000Z",
      homeTeamId: "1",
      homeTeamName: "Arsenal",
      awayTeamId: "2",
      awayTeamName: "Chelsea",
      tournament: "Premier League",
      season: "2026/27",
    },
  ],
};

test("expandTeamstatsDocument emits normalized source matches from full rows", () => {
  const rows = expandTeamstatsDocument(sourceDocument);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    matchId: "101",
    kickoffAt: "2026-10-21T18:00:00.000Z",
    matchDate: "2026-10-21",
    homeTeamId: "1",
    homeTeamName: "Arsenal",
    awayTeamId: "2",
    awayTeamName: "Chelsea",
    leagueName: "Premier League",
    seasonName: "2026/27",
    sourceTeamId: "42",
    sourceTeamName: "Arsenal",
    sourceTeamRole: "home",
    sourceDocumentImportedAt: "2026-06-20T10:00:00.000Z",
    sourceRowSavedAt: "2026-06-20T10:00:00.000Z",
    sourceFile: "arsenal_home_match_stats.json",
  });
});

test("buildMatchIndex deduplicates duplicate source rows by match identity", () => {
  const rows = expandTeamstatsDocument(sourceDocument);
  const matches = buildMatchIndex(rows);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].matchId, "101");
  assert.equal(matches[0].firstSeenAt, "2026-06-20T10:00:00.000Z");
  assert.equal(matches[0].lastSeenAt, "2026-06-20T10:05:00.000Z");
});

test("summarizeMatchRows reports bounds and future window counts", () => {
  const rows = expandTeamstatsDocument(sourceDocument);
  const summary = summarizeMatchRows(rows, {
    now: "2026-06-20T00:00:00.000Z",
    horizonDays: 30,
  });

  assert.equal(summary.totalRows, 2);
  assert.equal(summary.uniqueMatches, 1);
  assert.equal(summary.futureMatchesWithinWindow, 0);
  assert.equal(summary.maxKickoffAt, "2026-10-21T18:00:00.000Z");
});

test("TEAMSTATS_MATCH_PROJECTION only requests the fields needed for import", () => {
  assert.deepEqual(TEAMSTATS_MATCH_PROJECTION, {
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
  });
});
