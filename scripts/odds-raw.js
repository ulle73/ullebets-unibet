import { clientPromise } from "../lib/db.js";
import {
  resolveOptionalLimit,
  resolveReferenceNow,
  resolveTargetDbName,
} from "../lib/config.js";
import { buildRawOddsSnapshot } from "../lib/raw-odds-snapshots.js";
import {
  fetchEventOdds,
  fetchLeagueEvents,
  findBestMatchingEvent,
  loadLeagueConfig,
  selectLeagueConfigs,
} from "../lib/unibet-kambi.js";

const client = await clientPromise;

try {
  const db = client.db(resolveTargetDbName());
  const jobsCollection = db.collection("odds_fetch_jobs");
  const matchesCollection = db.collection("matches");
  const rawSnapshots = db.collection("raw_odds_snapshots");

  const referenceNow = resolveReferenceNow();
  const jobLimit = resolveOptionalLimit("ODDS_FETCH_JOB_LIMIT");
  const dueJobsCursor = jobsCollection
    .find({ status: "pending", due_at: { $lte: referenceNow } })
    .sort({ due_at: 1 });
  if (jobLimit != null) {
    dueJobsCursor.limit(jobLimit);
  }
  const dueJobs = await dueJobsCursor.toArray();

  let loadedConfigPath = null;
  let loadedConfig = null;
  if (dueJobs.length > 0) {
    const loaded = await loadLeagueConfig();
    loadedConfigPath = loaded.path;
    loadedConfig = loaded.config;
  }

  const unmatched = [];
  const savedSnapshots = [];

  for (const job of dueJobs) {
    const match = await matchesCollection.findOne({ _id: job.match_id });
    if (!match) {
      await jobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "missing_match",
            matched: false,
            updated_at: new Date().toISOString(),
          },
        }
      );
      unmatched.push({
        jobId: job._id,
        reason: "missing_match",
      });
      continue;
    }

    const candidateLeagueConfigs = selectLeagueConfigs(loadedConfig, match.leagueName);
    if (!candidateLeagueConfigs.length) {
      await jobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "missing_league_config",
            matched: false,
            updated_at: new Date().toISOString(),
          },
        }
      );
      unmatched.push({
        jobId: job._id,
        leagueName: match.leagueName,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        reason: "missing_league_config",
      });
      continue;
    }

    let matchedLeagueBaseUrl = null;
    let event = null;
    for (const leagueConfig of candidateLeagueConfigs) {
      const events = await fetchLeagueEvents(leagueConfig.baseUrl);
      event = findBestMatchingEvent(events, match);
      if (event) {
        matchedLeagueBaseUrl = leagueConfig.baseUrl;
        break;
      }
    }

    if (!event) {
      await jobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "unmatched",
            matched: false,
            updated_at: new Date().toISOString(),
          },
        }
      );
      unmatched.push({
        jobId: job._id,
        leagueName: match.leagueName,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        candidateLeagueCount: candidateLeagueConfigs.length,
        reason: "unmatched",
      });
      continue;
    }

    const fetchedAt = new Date().toISOString();
    const payload = await fetchEventOdds(event.id);
    const snapshot = buildRawOddsSnapshot({
      match,
      job: {
        _id: job._id,
        snapshotLabel: job.snapshot_label,
      },
      payload,
      unibetEventId: event.id,
      matched: true,
      fetchedAt,
    });

    await rawSnapshots.updateOne(
      { _id: snapshot._id },
      {
        $set: snapshot,
        $setOnInsert: {
          created_at: fetchedAt,
        },
      },
      { upsert: true }
    );

    await jobsCollection.updateOne(
      { _id: job._id },
      {
        $set: {
          status: "completed",
          matched: true,
          unibet_event_id: String(event.id),
          fetched_at: fetchedAt,
          payload_hash: snapshot.payload_hash,
          payload_size_bytes: snapshot.payload_size_bytes,
          updated_at: fetchedAt,
        },
      }
    );

    savedSnapshots.push({
      jobId: job._id,
      matchId: match.matchId,
      snapshotLabel: job.snapshot_label,
      unibetEventId: String(event.id),
      matchedLeagueBaseUrl,
    });
  }

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        referenceNow,
        dueJobs: dueJobs.length,
        jobLimit,
        savedSnapshots: savedSnapshots.length,
        unmatchedCount: unmatched.length,
        unmatched,
        savedSnapshotRefs: savedSnapshots,
        leagueConfigPath: loadedConfigPath,
      },
      null,
      2
    )
  );
} finally {
  await client.close();
}
