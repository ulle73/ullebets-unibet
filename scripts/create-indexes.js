import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";

async function main() {
  const db = await getDb();

  await db.collection("matches").createIndex({ source: 1, source_event_id: 1 }, { unique: true });
  await db.collection("matches").createIndex({ league_key: 1, start_time: 1 });
  await db.collection("matches").createIndex({ start_time: 1, status: 1 });

  await db.collection("raw_unibet_discovery").createIndex({ source: 1, league_key: 1, fetched_at: -1 });
  await db.collection("raw_unibet_discovery").createIndex({ payload_hash: 1 }, { unique: true });

  await db.collection("odds_fetch_jobs").createIndex({ status: 1, due_at: 1 });
  await db.collection("odds_fetch_jobs").createIndex({ match_id: 1, source: 1, snapshot_label: 1 }, { unique: true });

  await db.collection("raw_odds_snapshots").createIndex({ source: 1, source_event_id: 1, snapshot_label: 1, payload_hash: 1 }, { unique: true });
  await db.collection("raw_odds_snapshots").createIndex({ match_id: 1, fetched_at: -1 });

  const ttlOptions = {};
  ttlOptions["expire" + "AfterSeconds"] = config.rawOddsTtlDays * 86400;
  await db.collection("raw_odds_snapshots").createIndex({ fetched_at: 1 }, ttlOptions);

  await db.collection("coverage_reports").createIndex({ created_at: -1 });

  console.log({ ok: true, database: db.databaseName, rawOddsTtlDays: config.rawOddsTtlDays });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
