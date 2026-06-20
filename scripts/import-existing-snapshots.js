import { getDb, closeMongoClient } from "../lib/db.js";
import { getSourceDb, closeSourceDb, getSourceDbName } from "../lib/source-db.js";
import { sha256Json, jsonSizeBytes } from "../lib/hash.js";

async function main() {
  const targetDb = await getDb();
  const sourceDb = await getSourceDb();
  const limit = Number(process.env.SNAPSHOT_IMPORT_LIMIT || 50);
  const sourceCollection = "analysis-snapshots";

  const cursor = sourceDb.collection(sourceCollection).find({}).sort({ createdAt: -1 }).limit(limit);

  let snapshots = 0;
  let candidates = 0;

  for await (const snapshot of cursor) {
    snapshots += 1;
    const payload_hash = sha256Json(snapshot);
    const payload_size_bytes = jsonSizeBytes(snapshot);

    await targetDb.collection("raw_source_snapshots").updateOne(
      { source_collection: sourceCollection, source_id: String(snapshot._id) },
      { $set: { source_database: getSourceDbName(), source_collection: sourceCollection, source_id: String(snapshot._id), payload_hash, payload_size_bytes, payload: snapshot, imported_at: new Date() } },
      { upsert: true }
    );

    const shortlist = Array.isArray(snapshot.shortlist) ? snapshot.shortlist : [];
    for (let i = 0; i < shortlist.length; i += 1) {
      const item = shortlist[i];
      if (!item || !item.matchId) continue;
      await targetDb.collection("source_shortlist_items").updateOne(
        { source_snapshot_id: String(snapshot._id), source_index: i },
        { $set: { source_snapshot_id: String(snapshot._id), source_index: i, match_id: String(item.matchId), date: snapshot.date || null, createdAt: snapshot.createdAt || null, item, imported_at: new Date() } },
        { upsert: true }
      );
      candidates += 1;
    }
  }

  console.log({ ok: true, sourceDatabase: getSourceDbName(), targetDatabase: targetDb.databaseName, snapshots, candidates });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await closeSourceDb();
  await closeMongoClient();
});
