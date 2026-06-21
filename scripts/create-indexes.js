import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";
import { cleanupDuplicatesByKey, findDuplicateKeys } from "../lib/maintenance/dedupe.js";

function isDuplicateKeyError(err) {
  return err?.code === 11000 || err?.codeName === "DuplicateKey";
}

async function dropIndexIfExists(db, collectionName, indexName) {
  const collection = db.collection(collectionName);

  let indexes = [];
  try {
    indexes = await collection.indexes();
  } catch (err) {
    if (err?.codeName === "NamespaceNotFound") return false;
    throw err;
  }

  if (!indexes.some((index) => index.name === indexName)) return false;

  await collection.dropIndex(indexName);
  console.log({ collection: collectionName, droppedLegacyIndex: indexName });
  return true;
}

async function createUniqueIndexAfterCleanup(db, collectionName, keys, options = {}) {
  const keyFields = Object.keys(keys);
  const cleanup = await cleanupDuplicatesByKey(db, {
    collectionName,
    keyFields,
    keepSort: options.keepSort || {},
  });

  if (cleanup.duplicateGroupsFound > 0) {
    console.warn({
      collection: collectionName,
      cleanedDuplicateGroups: cleanup.duplicateGroupsFound,
      removedDocuments: cleanup.documentsRemovedOrWouldRemove,
      sample: cleanup.samples.slice(0, 5),
    });
  }

  try {
    await db.collection(collectionName).createIndex(keys, {
      ...options,
      unique: true,
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;

    const duplicates = await findDuplicateKeys(db, collectionName, keyFields);
    const sample = duplicates.slice(0, 10).map((group) => ({
      key: group._id,
      count: group.count,
      ids: group.ids.map(String),
    }));

    throw new Error(
      [
        `Could not create unique index on ${collectionName}(${keyFields.join(", ")}).`,
        "Duplicates still exist after cleanup.",
        `Sample: ${JSON.stringify(sample, null, 2)}`,
      ].join("\n")
    );
  }
}

async function main() {
  const db = await getDb();

  await createUniqueIndexAfterCleanup(db, "matches", { source: 1, source_event_id: 1 });
  await db.collection("matches").createIndex({ league_key: 1, start_time: 1 });
  await db.collection("matches").createIndex({ start_time: 1, status: 1 });

  await db.collection("raw_unibet_discovery").createIndex({ source: 1, league_key: 1, fetched_at: -1 });

  // Legacy version used a unique index on payload_hash only. That is too broad:
  // the same listView payload can legitimately be fetched for multiple jobs/times.
  await dropIndexIfExists(db, "raw_unibet_discovery", "payload_hash_1");
  await db.collection("raw_unibet_discovery").createIndex(
    { source: 1, job_type: 1, source_event_id: 1, snapshot_label: 1, payload_hash: 1 },
    { unique: true }
  );

  await db.collection("odds_fetch_jobs").createIndex({ status: 1, due_at: 1 });
  await db.collection("odds_fetch_jobs").createIndex({ match_id: 1, source: 1, snapshot_label: 1 }, { unique: true });

  await db.collection("raw_odds_snapshots").createIndex(
    { source: 1, job_type: 1, source_event_id: 1, snapshot_label: 1, payload_hash: 1 },
    { unique: true }
  );
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
