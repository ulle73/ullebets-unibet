import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name}: ${raw}`);
  return value;
}

export const config = {
  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB || "ullebets_unibet",
  maxLeaguesPerRun: intEnv("MAX_LEAGUES_PER_RUN", 5),
  maxMatchesPerRun: intEnv("MAX_MATCHES_PER_RUN", 50),
  maxOddsJobsPerRun: intEnv("MAX_ODDS_JOBS_PER_RUN", 25),
  maxRawPayloadMbPerRun: intEnv("MAX_RAW_PAYLOAD_MB_PER_RUN", 200),
  rawOddsTtlDays: intEnv("RAW_ODDS_TTL_DAYS", 30),
  unibetDiscoveryUrlTemplate: process.env.UNIBET_DISCOVERY_URL_TEMPLATE || "",
  unibetEventOddsUrlTemplate: process.env.UNIBET_EVENT_ODDS_URL_TEMPLATE || "",
  unibetCookie: process.env.UNIBET_COOKIE || "",
  unibetUserAgent: process.env.UNIBET_USER_AGENT || "Mozilla/5.0",
};

export function assertSafeDatabaseName(dbName = config.mongoDbName) {
  if (!dbName) throw new Error("Missing MONGODB_DB");
  if (dbName !== "ullebets_unibet") {
    throw new Error(`Unexpected MONGODB_DB='${dbName}'. This repo must use ullebets_unibet.`);
  }
}

export function requireMongoConfig() {
  if (!config.mongoUri) throw new Error("Missing MONGODB_URI");
  assertSafeDatabaseName(config.mongoDbName);
}
