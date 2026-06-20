import { getDb } from "./db.js";
import { buildOddsJobTimes } from "./time.js";

export async function scheduleOddsJobsForMatch(match) {
  const db = await getDb();
  const now = new Date();
  const jobs = buildOddsJobTimes(match.start_time, now);

  for (const job of jobs) {
    await db.collection("odds_fetch_jobs").updateOne(
      {
        match_id: match._id,
        source: match.source,
        snapshot_label: job.snapshot_label,
      },
      {
        $setOnInsert: {
          match_id: match._id,
          source: match.source,
          source_event_id: match.source_event_id,
          league_key: match.league_key,
          snapshot_label: job.snapshot_label,
          due_at: job.due_at,
          status: "pending",
          attempts: 0,
          created_at: now,
        },
        $set: {
          source_event_id: match.source_event_id,
          league_key: match.league_key,
          start_time: match.start_time,
          updated_at: now,
        },
      },
      { upsert: true }
    );
  }

  return jobs.length;
}

export async function claimDueOddsJobs(limit) {
  const db = await getDb();
  const jobs = [];

  for (let i = 0; i < limit; i += 1) {
    const res = await db.collection("odds_fetch_jobs").findOneAndUpdate(
      { status: "pending", due_at: { $lte: new Date() } },
      {
        $set: { status: "running", started_at: new Date(), updated_at: new Date() },
        $inc: { attempts: 1 },
      },
      { sort: { due_at: 1 }, returnDocument: "after" }
    );

    if (!res) break;
    jobs.push(res);
  }

  return jobs;
}

export async function markJobDone(jobId, extra = {}) {
  const db = await getDb();
  await db.collection("odds_fetch_jobs").updateOne(
    { _id: jobId },
    { $set: { status: "done", finished_at: new Date(), updated_at: new Date(), ...extra } }
  );
}

export async function markJobRetryOrFailed(job, error) {
  const db = await getDb();
  const attempts = Number(job.attempts || 1);
  const failed = attempts >= 4;
  const retryDelayMinutes = attempts === 1 ? 1 : attempts === 2 ? 3 : 5;

  await db.collection("odds_fetch_jobs").updateOne(
    { _id: job._id },
    {
      $set: {
        status: failed ? "failed" : "pending",
        due_at: failed ? job.due_at : new Date(Date.now() + retryDelayMinutes * 60 * 1000),
        last_error: error?.stack || error?.message || String(error),
        updated_at: new Date(),
      },
    }
  );
}
