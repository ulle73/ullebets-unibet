import { getSourceDb, closeSourceDb, getSourceDbName } from "../lib/source-db.js";
import { closeMongoClient } from "../lib/db.js";

async function main() {
  const db = await getSourceDb();
  const collections = await db.listCollections().toArray();
  const rows = [];

  for (const item of collections) {
    const col = db.collection(item.name);
    let count = null;
    let sampleKeys = [];
    try {
      count = await col.estimatedDocumentCount();
      const sample = await col.findOne({});
      sampleKeys = sample && typeof sample === "object" ? Object.keys(sample).slice(0, 30) : [];
    } catch (err) {
      sampleKeys = [`error: ${err.message}`];
    }
    rows.push({ collection: item.name, count, sampleKeys });
  }

  rows.sort((a, b) => String(a.collection).localeCompare(String(b.collection)));
  console.log(JSON.stringify({ ok: true, sourceDatabase: getSourceDbName(), collections: rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await closeSourceDb();
  await closeMongoClient();
});
