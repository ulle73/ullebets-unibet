import { clientPromise } from "../lib/db.js";
import {
  resolveImportHorizonDays,
  resolveOptionalLimit,
  resolveReferenceNow,
  resolveSourceDbName,
  resolveTargetDbName,
} from "../lib/config.js";
import {
  TEAMSTATS_MATCH_PROJECTION,
  buildMatchIndex,
  collectTeamstatsRows,
  filterMatchesInWindow,
} from "../lib/teamstats-source.js";
import { buildSnapshotJobs } from "../lib/match-scheduler.js";

const client = await clientPromise;

try {
  const sourceDb = client.db(resolveSourceDbName());
  const targetDb = client.db(resolveTargetDbName());
  const referenceNow = resolveReferenceNow();
  const importMatchLimit = resolveOptionalLimit("IMPORT_MATCH_LIMIT");

  const sourceDocuments = await sourceDb
    .collection("teamstats")
    .find({}, { projection: TEAMSTATS_MATCH_PROJECTION })
    .toArray();

  const rows = collectTeamstatsRows(sourceDocuments);
  const allMatches = buildMatchIndex(rows);
  const eligibleMatches = filterMatchesInWindow(allMatches, {
    now: referenceNow,
    horizonDays: resolveImportHorizonDays(),
  });
  const selectedMatches =
    importMatchLimit == null ? eligibleMatches : eligibleMatches.slice(0, importMatchLimit);

  const matchesCollection = targetDb.collection("matches");
  const jobsCollection = targetDb.collection("odds_fetch_jobs");

  let importedMatches = 0;
  let scheduledJobs = 0;

  for (const match of selectedMatches) {
    const importedAt = referenceNow;
    const matchDocument = {
      _id: match._id,
      sourceMatchKey: match.sourceMatchKey,
      matchId: match.matchId,
      kickoffAt: match.kickoffAt,
      matchDate: match.matchDate,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      leagueName: match.leagueName,
      seasonName: match.seasonName,
      firstSeenAt: match.firstSeenAt,
      lastSeenAt: match.lastSeenAt,
      sourceDatabase: resolveSourceDbName(),
      sourceCollection: "teamstats",
      sourceFiles: match.sourceFiles,
      importedAt,
      updatedAt: importedAt,
    };

    const matchResult = await matchesCollection.updateOne(
      { _id: matchDocument._id },
      {
        $set: matchDocument,
        $setOnInsert: {
          createdAt: importedAt,
        },
      },
      { upsert: true }
    );

    importedMatches += matchResult.upsertedCount || 0;

    const jobs = buildSnapshotJobs(matchDocument, matchDocument.firstSeenAt || importedAt);
    for (const job of jobs) {
      const jobDocument = {
        _id: `${matchDocument._id}:${job.snapshotLabel}`,
        match_id: matchDocument._id,
        source_match_id: matchDocument.matchId,
        snapshot_label: job.snapshotLabel,
        due_at: job.dueAt,
        kickoff_at: matchDocument.kickoffAt,
        home_team_name: matchDocument.homeTeamName,
        away_team_name: matchDocument.awayTeamName,
        league_name: matchDocument.leagueName,
        status: "pending",
        updated_at: importedAt,
      };

      const jobResult = await jobsCollection.updateOne(
        { _id: jobDocument._id },
        {
          $set: jobDocument,
          $setOnInsert: {
            created_at: importedAt,
          },
        },
        { upsert: true }
      );
      scheduledJobs += jobResult.upsertedCount || 0;
    }
  }

  console.log(
    JSON.stringify(
      {
        sourceDatabase: resolveSourceDbName(),
        targetDatabase: resolveTargetDbName(),
        referenceNow,
        sourceRows: rows.length,
        uniqueSourceMatches: allMatches.length,
        eligibleMatches: eligibleMatches.length,
        selectedMatches: selectedMatches.length,
        importMatchLimit,
        importedMatches,
        scheduledJobs,
        importHorizonDays: resolveImportHorizonDays(),
        selectedMatchPreview: selectedMatches.slice(0, 5).map((match) => ({
          matchId: match.matchId,
          matchDate: match.matchDate,
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
        })),
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
