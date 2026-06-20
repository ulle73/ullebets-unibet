import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

export const SOURCE_DB_NAME = "app";
export const TARGET_DB_NAME = "ullebets_unibet";
export const DEFAULT_IMPORT_HORIZON_DAYS = 30;

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return value;
}

export function resolveTargetDbName(env = process.env) {
  const value = env.MONGODB_DB?.trim();
  if (value !== TARGET_DB_NAME) {
    throw new Error(`MONGODB_DB must be ${TARGET_DB_NAME}, received ${value || "missing"}`);
  }
  return value;
}

export function resolveSourceDbName(env = process.env) {
  return env.SOURCE_MONGODB_DB?.trim() || SOURCE_DB_NAME;
}

export function resolveLegacyRepoRoot(env = process.env, cwd = process.cwd()) {
  if (env.ULLEBETS_LEGACY_ROOT?.trim()) {
    return env.ULLEBETS_LEGACY_ROOT.trim();
  }
  return path.resolve(cwd, "..", "frontend", "ullebets-vecel");
}

export function resolveImportHorizonDays(env = process.env) {
  const raw = Number(env.IMPORT_HORIZON_DAYS ?? DEFAULT_IMPORT_HORIZON_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_IMPORT_HORIZON_DAYS;
  }
  return Math.floor(raw);
}

export function resolveReferenceNow(env = process.env) {
  const raw = env.NOW_ISO?.trim();
  if (!raw) {
    return new Date().toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`NOW_ISO must be a valid ISO timestamp, received ${raw}`);
  }

  return parsed.toISOString();
}

export function resolveOptionalLimit(key, env = process.env) {
  const raw = env[key];
  if (raw == null || String(raw).trim() === "") {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer, received ${raw}`);
  }

  return parsed;
}

export const config = {
  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB || TARGET_DB_NAME,
  sourceMongoDbName: process.env.SOURCE_MONGODB_DB || SOURCE_DB_NAME,
  importHorizonDays: resolveImportHorizonDays(),
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
  if (dbName !== TARGET_DB_NAME) {
    throw new Error(`Unexpected MONGODB_DB='${dbName}'. This repo must use ${TARGET_DB_NAME}.`);
  }
}

export function requireMongoConfig() {
  if (!config.mongoUri) throw new Error("Missing MONGODB_URI");
  assertSafeDatabaseName(config.mongoDbName);
}
