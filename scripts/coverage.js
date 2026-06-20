import { clientPromise } from "../lib/db.js";
import {
  resolveImportHorizonDays,
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

const client = await clientPromise;

try {
  const sourceDb = client.db(resolveSourceDbName());
  const targetDb = client.db(resolveTargetDbName());
  const referenceNow = resolveReferenceNow();

  const sourceDocuments = await sourceDb
    .collection("teamstats")
    .find({}, { projection: TEAMSTATS_MATCH_PROJECTION })
    .toArray();
  const sourceRows = collectTeamstatsRows(sourceDocuments);
  const sourceMatches = buildMatchIndex(sourceRows);
  const futureSourceMatches = filterMatchesInWindow(sourceMatches, {
    now: referenceNow,
    horizonDays: resolveImportHorizonDays(),
  });

  const matchesCollection = targetDb.collection("matches");
  const jobsCollection = targetDb.collection("odds_fetch_jobs");
  const rawSnapshotsCollection = targetDb.collection("raw_odds_snapshots");

  const [matchCount, jobCount, snapshotCount] = await Promise.all([
    matchesCollection.countDocuments(),
    jobsCollection.countDocuments(),
    rawSnapshotsCollection.countDocuments(),
  ]);

  const [jobsByStatus, jobsByLabel, unmatchedJobs] = await Promise.all([
    jobsCollection
      .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray(),
    jobsCollection
      .aggregate([{ $group: { _id: "$snapshot_label", count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray(),
    jobsCollection
      .find({ matched: false })
      .project({
        _id: 1,
        snapshot_label: 1,
        league_name: 1,
        home_team_name: 1,
        away_team_name: 1,
        status: 1,
      })
      .limit(20)
      .toArray(),
  ]);

  console.log(
    JSON.stringify(
      {
        sourceDatabase: resolveSourceDbName(),
        targetDatabase: resolveTargetDbName(),
        referenceNow,
        sourceDocuments: sourceDocuments.length,
        sourceRows: sourceRows.length,
        sourceUniqueMatches: sourceMatches.length,
        futureSourceMatchesWithinWindow: futureSourceMatches.length,
        importHorizonDays: resolveImportHorizonDays(),
        matches: matchCount,
        oddsFetchJobs: jobCount,
        rawOddsSnapshots: snapshotCount,
        jobsByStatus,
        jobsByLabel,
        unmatchedJobs,
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
