import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";
import { cleanupDuplicatesByKey, findDuplicateKeys } from "../lib/maintenance/dedupe.js";

function isDuplicateKeyError(err) {
  return err?.code === 11000 || err?.codeName === "DuplicateKey";
}

function normalizeKeySpec(keys) {
  return Object.entries(keys).map(([field, direction]) => [field, direction]);
}

function indexKeyEquals(indexKey, requestedKeys) {
  const existing = normalizeKeySpec(indexKey || {});
  const requested = normalizeKeySpec(requestedKeys || {});

  if (existing.length !== requested.length) return false;

  return existing.every(([field, direction], index) => {
    const [requestedField, requestedDirection] = requested[index];
    return field === requestedField && direction === requestedDirection;
  });
}

async function getIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (err) {
    if (err?.codeName === "NamespaceNotFound") return [];
    throw err;
  }
}

function isCompatibleExistingIndex(index, options = {}) {
  if (options.unique && index.unique !== true) return false;

  if (options.expireAfterSeconds != null) {
    return index.expireAfterSeconds === options.expireAfterSeconds;
  }

  return true;
}

async function ensureIndex(db, collectionName, keys, options = {}) {
  const collection = db.collection(collectionName);
  const indexes = await getIndexes(collection);
  const existing = indexes.find((index) => indexKeyEquals(index.key, keys));

  if (existing) {
    if (isCompatibleExistingIndex(existing, options)) {
      console.log({ collection: collectionName, existingIndex: existing.name, skippedCreateForKeys: keys });
      return existing.name;
    }

    await collection.dropIndex(existing.name);
    console.warn({ collection: collectionName, droppedIncompatibleIndex: existing.name, keys });
  }

  return collection.createIndex(keys, options);
}

async function dropIndexIfExists(db, collectionName, indexName) {
  const collection = db.collection(collectionName);
  const indexes = await getIndexes(collection);

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

  const createIndexOptions = { ...options, unique: true };
  delete createIndexOptions.keepSort;

  try {
    await ensureIndex(db, collectionName, keys, createIndexOptions);
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
  await ensureIndex(db, "matches", { league_key: 1, start_time: 1 });
  await ensureIndex(db, "matches", { start_time: 1, status: 1 });

  await ensureIndex(db, "raw_unibet_discovery", { source: 1, league_key: 1, fetched_at: -1 });

  // Legacy version used a unique index on payload_hash only. That is too broad:
  // the same listView payload can legitimately be fetched for multiple jobs/times.
  await dropIndexIfExists(db, "raw_unibet_discovery", "payload_hash_1");
  await createUniqueIndexAfterCleanup(
    db,
    "raw_unibet_discovery",
    { source: 1, job_type: 1, source_event_id: 1, snapshot_label: 1, payload_hash: 1 }
  );

  await ensureIndex(db, "odds_fetch_jobs", { status: 1, due_at: 1 });
  await createUniqueIndexAfterCleanup(
    db,
    "odds_fetch_jobs",
    { match_id: 1, source: 1, snapshot_label: 1 }
  );

  await createUniqueIndexAfterCleanup(
    db,
    "raw_odds_snapshots",
    { source: 1, job_type: 1, source_event_id: 1, snapshot_label: 1, payload_hash: 1 }
  );
  await ensureIndex(db, "raw_odds_snapshots", { match_id: 1, fetched_at: -1 });

  const ttlOptions = {};
  ttlOptions["expire" + "AfterSeconds"] = config.rawOddsTtlDays * 86400;
  await ensureIndex(db, "raw_odds_snapshots", { fetched_at: 1 }, ttlOptions);

  await ensureIndex(db, "coverage_reports", { created_at: -1 });

  console.log({ ok: true, database: db.databaseName, rawOddsTtlDays: config.rawOddsTtlDays });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
