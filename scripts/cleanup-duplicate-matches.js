import { getDb, closeMongoClient } from "../lib/db.js";
import { cleanupDuplicatesByKey } from "../lib/maintenance/dedupe.js";

async function main() {
  const db = await getDb();
  const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";

  const result = await cleanupDuplicatesByKey(db, {
    collectionName: "matches",
    keyFields: ["source", "source_event_id"],
    dryRun,
  });

  console.log(JSON.stringify({ ok: true, database: db.databaseName, ...result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
