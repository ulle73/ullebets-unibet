import { clientPromise } from "../lib/db.js";
import {
  resolveImportHorizonDays,
  resolveReferenceNow,
  resolveSourceDbName,
} from "../lib/config.js";
import {
  TEAMSTATS_MATCH_PROJECTION,
  collectTeamstatsRows,
  summarizeMatchRows,
} from "../lib/teamstats-source.js";

const client = await clientPromise;

try {
  const db = client.db(resolveSourceDbName());
  const teamstats = db.collection("teamstats");
  const documents = await teamstats.find({}, { projection: TEAMSTATS_MATCH_PROJECTION }).toArray();
  const referenceNow = resolveReferenceNow();
  const rows = collectTeamstatsRows(documents);
  const summary = summarizeMatchRows(rows, {
    now: referenceNow,
    horizonDays: resolveImportHorizonDays(),
  });

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        collection: teamstats.collectionName,
        referenceNow,
        sourceDocuments: documents.length,
        importHorizonDays: resolveImportHorizonDays(),
        ...summary,
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
