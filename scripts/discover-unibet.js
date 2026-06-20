import fs from "node:fs/promises";
import path from "node:path";
import { getDb, closeMongoClient } from "../lib/db.js";
import { config } from "../lib/config.js";
import { addDays, nowUtc } from "../lib/time.js";
import { saveRawResponse } from "../lib/raw.js";
import { scheduleOddsJobsForMatch } from "../lib/jobs.js";
import { fetchUnibetLeagueDiscovery } from "../lib/unibet/client.js";
import { parseUnibetEvents } from "../lib/unibet/parse.js";

async function loadLeagues() {
  const filePath = process.env.LEAGUES_AND_TEAMS_PATH || path.join("config", "leagues_and_teams.json");
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.leagues || [];
}

async function upsertMatch(db, event) {
  const now = new Date();
  const res = await db.collection("matches").findOneAndUpdate(
    { source: event.source, source_event_id: event.source_event_id },
    {
      $setOnInsert: { first_seen_at: now, created_at: now },
      $set: {
        ...event,
        status: "scheduled",
        last_seen_at: now,
        updated_at: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  return res;
}

async function main() {
  const db = await getDb();
  const from = nowUtc();
  const to = addDays(from, 7);
  const leagues = (await loadLeagues())
    .filter((league) => league.active !== false && league.sources?.unibet?.enabled !== false)
    .slice(0, config.maxLeaguesPerRun);

  let totalEvents = 0;
  let totalMatches = 0;
  let totalJobs = 0;
  let totalPayloadBytes = 0;

  for (const league of leagues) {
    const leagueKey = league.key || league.league_key || league.league_name;
    const response = await fetchUnibetLeagueDiscovery({ league, from, to });

    const rawDoc = await saveRawResponse({
      collectionName: "raw_unibet_discovery",
      source: "unibet",
      job_type: "discover_events",
      league_key: leagueKey,
      request_url: response.request_url,
      request_params: response.request_params,
      response_status: response.response_status,
      response_headers: response.response_headers,
      payload: response.payload,
      extra: { from, to },
    });

    totalPayloadBytes += rawDoc.payload_size_bytes;
    if (totalPayloadBytes > config.maxRawPayloadMbPerRun * 1024 * 1024) {
      throw new Error(`Raw payload limit exceeded: ${config.maxRawPayloadMbPerRun} MB per run`);
    }

    const events = parseUnibetEvents(response.payload, league).slice(0, config.maxMatchesPerRun - totalMatches);
    totalEvents += events.length;

    for (const event of events) {
      const match = await upsertMatch(db, event);
      totalMatches += 1;
      totalJobs += await scheduleOddsJobsForMatch(match);
      if (totalMatches >= config.maxMatchesPerRun) break;
    }

    if (totalMatches >= config.maxMatchesPerRun) break;
  }

  console.log({
    ok: true,
    database: db.databaseName,
    leagues: leagues.length,
    totalEvents,
    totalMatches,
    totalJobs,
    totalPayloadMb: Number((totalPayloadBytes / 1024 / 1024).toFixed(3)),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => closeMongoClient());
