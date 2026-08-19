const MAX_METADATA_BYTES = 12 * 1024;
const SENSITIVE_KEYS = new Set(["password", "token", "authorization", "cookie", "secret"]);

function redact(value, key = "") {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) return "[REDACTED]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)])
    );
  }
  return typeof value === "string" && value.length > 2000
    ? `${value.slice(0, 2000)}…[TRUNCATED]`
    : value;
}

function compactMetadata(metadata) {
  const sanitized = redact(metadata);
  let encoded;
  try {
    encoded = JSON.stringify(sanitized);
  } catch (_) {
    return { truncated: true, value: "[UNSERIALIZABLE METADATA]" };
  }
  if (Buffer.byteLength(encoded, "utf8") <= MAX_METADATA_BYTES) return sanitized;
  return {
    truncated: true,
    originalBytes: Buffer.byteLength(encoded, "utf8"),
    preview: encoded.slice(0, MAX_METADATA_BYTES),
  };
}

module.exports = { compactMetadata, redact, MAX_METADATA_BYTES };
