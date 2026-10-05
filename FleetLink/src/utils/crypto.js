const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const configuredSecret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_SECRET) {
  throw new Error("ENCRYPTION_SECRET must be configured in production; do not reuse JWT_SECRET for encrypted personal data");
}
if (process.env.NODE_ENV === "production" && Buffer.byteLength(process.env.ENCRYPTION_SECRET, "utf8") < 32) {
  throw new Error("ENCRYPTION_SECRET must contain at least 32 bytes in production");
}
if (process.env.NODE_ENV === "production" && process.env.ENCRYPTION_SECRET_PREVIOUS && Buffer.byteLength(process.env.ENCRYPTION_SECRET_PREVIOUS, "utf8") < 32) {
  throw new Error("ENCRYPTION_SECRET_PREVIOUS must contain at least 32 bytes in production");
}
if (process.env.NODE_ENV === "production" && process.env.PII_HASH_SECRET && Buffer.byteLength(process.env.PII_HASH_SECRET, "utf8") < 32) {
  throw new Error("PII_HASH_SECRET must contain at least 32 bytes in production");
}
if (!configuredSecret) console.warn("ENCRYPTION_SECRET is not set; using a development-only key. Existing encrypted values may not be readable after changing this key.");
const activeSecret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || "fleetlink-development-only-key-do-not-use-in-production";
const HASH_SECRET = process.env.PII_HASH_SECRET || activeSecret;
const deriveKey = (secret) => crypto.createHash("sha256").update(secret).digest();
const ACTIVE_KEY = deriveKey(activeSecret);
const DECRYPTION_KEYS = [ACTIVE_KEY, process.env.ENCRYPTION_SECRET_PREVIOUS && deriveKey(process.env.ENCRYPTION_SECRET_PREVIOUS)].filter(Boolean);

function stableHash(value) {
  if (!value) return null;
  return crypto.createHmac("sha256", HASH_SECRET).update(String(value).trim().toUpperCase()).digest("hex");
}

function encryptText(plainText) {
  if (!plainText) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ACTIVE_KEY, iv);
  let encrypted = cipher.update(String(plainText), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptText(cipherText) {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.includes(":")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText;
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    for (const key of DECRYPTION_KEYS) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
      } catch { /* Try the previous configured key before giving up. */ }
    }
    return cipherText;
  } catch (error) {
    return cipherText;
  }
}

module.exports = { encryptText, decryptText, stableHash };
