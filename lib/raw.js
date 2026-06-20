import { getDb } from "./db.js";
import { sha256Json, jsonSizeBytes } from "./hash.js";

export function countMarkets(payload) {
  let marketCount = 0;
  let selectionCount = 0;

  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    const keys = Object.keys(value).map((key) => key.toLowerCase());
    const looksLikeMarket = keys.some((key) => ["outcomes", "selections", "betoffers", "betoffer"].includes(key));
    if (looksLikeMarket) {
      marketCount += 1;
      for (const key of ["outcomes", "selections", "offers", "betOffers", "betoffers"]) {
        if (Array.isArray(value[key])) selectionCount += value[key].length;
      }
    }

    for (const child of Object.values(value)) walk(child);
  }

  walk(payload);
  return { market_count: marketCount, selection_count: selectionCount };
}

export async function saveRawResponse({
  collectionName,
  source,
  job_type,
  league_key,
  source_event_id,
  snapshot_label,
  request_url,
  request_params,
  response_status,
  response_headers,
  payload,
  extra = {},
}) {
  const db = await getDb();
  const payload_hash = sha256Json(payload);
  const payload_size_bytes = jsonSizeBytes(payload);
  const counts = countMarkets(payload);

  const doc = {
    source,
    job_type,
    league_key,
    source_event_id,
    snapshot_label,
    request_url,
    request_params: request_params || {},
    response_status,
    response_headers: response_headers || {},
    payload,
    payload_hash,
    payload_size_bytes,
    ...counts,
    ...extra,
    fetched_at: extra.fetched_at || new Date(),
    created_at: new Date(),
  };

  await db.collection(collectionName).updateOne(
    {
      source,
      job_type,
      source_event_id: source_event_id || null,
      snapshot_label: snapshot_label || null,
      payload_hash,
    },
    { $setOnInsert: doc },
    { upsert: true }
  );

  return doc;
}
