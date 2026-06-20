import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";
import { claimDueOddsJobs, markJobDone, markJobRetryOrFailed } from "../lib/jobs.js";
import { saveRawResponse } from "../lib/raw.js";
import { secondsBeforeStart } from "../lib/time.js";
import { fetchUnibetEventOdds } from "../lib/unibet/client.js";
import { detectMarketCoverage } from "../lib/unibet/parse.js";

async function main() {
  const db = await getDb();
  const jobs = await claimDueOddsJobs(config.maxOddsJobsPerRun);
  let payloadBytes = 0;
  let done = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const match = await db.collection("matches").findOne({ _id: job.match_id });
      if (!match) throw new Error(`Missing match for job ${job._id}`);

      const response = await fetchUnibetEventOdds({ match });
      const fetchedAt = new Date();
      const seconds = secondsBeforeStart(match.start_time, fetchedAt);

      const rawDoc = await saveRawResponse({
        collectionName: "raw_odds_snapshots",
        source: "unibet",
        job_type: "fetch_all_odds",
        league_key: match.league_key,
        source_event_id: match.source_event_id,
        snapshot_label: job.snapshot_label,
        request_url: response.request_url,
        request_params: response.request_params,
        response_status: response.response_status,
        response_headers: response.response_headers,
        payload: response.payload,
        extra: {
          match_id: match._id,
          fetch_job_id: job._id,
          scheduled_for: job.due_at,
          start_time: match.start_time,
          seconds_before_start: seconds,
          fetched_after_start: seconds < 0,
          coverage: detectMarketCoverage(response.payload),
          fetched_at: fetchedAt,
        },
      });

      payloadBytes += rawDoc.payload_size_bytes;
      if (payloadBytes > config.maxRawPayloadMbPerRun * 1024 * 1024) {
        throw new Error(`Raw payload limit exceeded: ${config.maxRawPayloadMbPerRun} MB per run`);
      }

      await markJobDone(job._id, {
        payload_hash: rawDoc.payload_hash,
        payload_size_bytes: rawDoc.payload_size_bytes,
        market_count: rawDoc.market_count,
        selection_count: rawDoc.selection_count,
      });
      done += 1;
    } catch (err) {
      failed += 1;
      await markJobRetryOrFailed(job, err);
    }
  }

  console.log({
    ok: true,
    database: db.databaseName,
    claimed: jobs.length,
    done,
    failed,
    payloadMb: Number((payloadBytes / 1024 / 1024).toFixed(3)),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
