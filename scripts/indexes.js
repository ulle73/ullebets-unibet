import { clientPromise } from "../lib/db.js";
import { resolveTargetDbName } from "../lib/config.js";

const client = await clientPromise;

try {
  const db = client.db(resolveTargetDbName());
  await Promise.all([
    db.createCollection("matches").catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    }),
    db.createCollection("odds_fetch_jobs").catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    }),
    db.createCollection("raw_odds_snapshots").catch((error) => {
      if (error?.codeName !== "NamespaceExists") throw error;
    }),
  ]);

  const matches = db.collection("matches");
  const jobs = db.collection("odds_fetch_jobs");
  const snapshots = db.collection("raw_odds_snapshots");

  const createdIndexes = {
    matches: [
      await matches.createIndex({ sourceMatchKey: 1 }, { unique: true, name: "source_match_key_unique" }),
      await matches.createIndex({ kickoffAt: 1, leagueName: 1 }, { name: "kickoff_league" }),
    ],
    odds_fetch_jobs: [
      await jobs.createIndex({ match_id: 1, snapshot_label: 1 }, { unique: true, name: "match_label_unique" }),
      await jobs.createIndex({ status: 1, due_at: 1 }, { name: "status_due_at" }),
    ],
    raw_odds_snapshots: [
      await snapshots.createIndex({ odds_fetch_job_id: 1 }, { unique: true, name: "job_id_unique" }),
      await snapshots.createIndex({ snapshot_label: 1, fetched_at: -1 }, { name: "label_fetched_at" }),
      await snapshots.createIndex({ payload_hash: 1 }, { name: "payload_hash" }),
    ],
  };

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        collections: ["matches", "odds_fetch_jobs", "raw_odds_snapshots"],
        createdIndexes,
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
