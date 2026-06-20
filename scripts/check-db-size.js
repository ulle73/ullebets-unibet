import { getDb, getMongoClient, closeMongoClient } from "../lib/db.js";

async function main() {
  const db = await getDb();
  const client = await getMongoClient();

  console.log({ ok: true, activeDatabase: db.databaseName });

  const admin = client.db().admin();
  const listed = await admin.listDatabases();
  const dbNames = listed.databases.map((item) => item.name).filter((name) => name === db.databaseName);

  for (const name of dbNames) {
    const currentDb = client.db(name);
    console.log(`\nDB: ${name}`);

    try {
      const stats = await currentDb.command({ dbStats: 1, scale: 1024 * 1024 });
      console.log({
        dataSizeMb: stats.dataSize,
        storageSizeMb: stats.storageSize,
        indexSizeMb: stats.indexSize,
        objects: stats.objects,
      });
    } catch (err) {
      console.log({ dbStatsError: err.message });
    }

    const collections = await currentDb.listCollections().toArray();
    for (const collection of collections) {
      try {
        const count = await currentDb.collection(collection.name).estimatedDocumentCount();
        console.log({ collection: collection.name, documents: count });
      } catch (err) {
        console.log({ collection: collection.name, error: err.message });
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
