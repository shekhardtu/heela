import { createHash, randomBytes } from "node:crypto";

/**
 * Token format: `hee_` + 32 bytes hex = 64 hex chars after the prefix.
 * Total length: 68. Prefix makes tokens immediately identifiable in logs
 * (treat like GitHub's `ghp_` / Stripe's `sk_live_`).
 */
const TOKEN_PREFIX = "hee_";
const TOKEN_BYTES = 32;

export interface GeneratedToken {
  raw: string;      // shown once to the user, never stored
  hash: string;     // stored in DB, used to authenticate
  prefix: string;   // first 12 chars including `hee_`, shown in token lists
}

export function generateApiToken(): GeneratedToken {
  const raw = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("hex");
  return {
    raw,
    hash: hashToken(raw),
    prefix: raw.slice(0, 12),
  };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Constant-time comparison — hashes can be compared with `===` safely since
 * they're fixed-length, but keeping an explicit helper makes intent clear.
 */
export function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
