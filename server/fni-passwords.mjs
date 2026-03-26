import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";
const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const normalizedPassword = String(password ?? "");
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(normalizedPassword, salt, SCRYPT_KEYLEN).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;

  const normalizedPassword = String(password ?? "");

  if (!storedHash.includes("$")) {
    const actual = Buffer.from(normalizedPassword);
    const expected = Buffer.from(storedHash);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  const [prefix, salt, expectedHex] = storedHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const actualHex = scryptSync(normalizedPassword, salt, SCRYPT_KEYLEN).toString("hex");
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function hashSessionToken(token) {
  return createHash("sha256").update(String(token ?? "")).digest("hex");
}
