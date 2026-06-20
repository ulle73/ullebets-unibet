import path from "node:path";

export const SOURCE_DB_NAME = "app";
export const TARGET_DB_NAME = "ullebets_unibet";
export const DEFAULT_IMPORT_HORIZON_DAYS = 30;

export function resolveTargetDbName(env = process.env) {
  const value = env.MONGODB_DB?.trim();
  if (value !== TARGET_DB_NAME) {
    throw new Error(`MONGODB_DB must be ${TARGET_DB_NAME}, received ${value || "missing"}`);
  }
  return value;
}

export function resolveSourceDbName() {
  return SOURCE_DB_NAME;
}

export function resolveLegacyRepoRoot(env = process.env, cwd = process.cwd()) {
  if (env.ULLEBETS_LEGACY_ROOT?.trim()) {
    return env.ULLEBETS_LEGACY_ROOT.trim();
  }
  return path.resolve(cwd, "..", "FRONTEND", "ullebets-vecel");
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
