import crypto from "crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function jsonSizeBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
