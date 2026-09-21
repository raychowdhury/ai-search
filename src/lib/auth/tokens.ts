import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";

export type TokenPurpose = "reset" | "verify";
const TTL_MS: Record<TokenPurpose, number> = { reset: 60 * 60 * 1000, verify: 7 * 24 * 60 * 60 * 1000 };

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a single-use token; only its hash is stored. Earlier unused tokens for the same purpose are invalidated. */
export function issueToken(db: Db, userId: string, purpose: TokenPurpose): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("hex");
  const ts = nowIso();
  const expiresAt = new Date(Date.now() + TTL_MS[purpose]).toISOString();
  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL").run(ts, userId, purpose);
  db.prepare("INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?,?,?,?,?,?)").run(newId(), userId, purpose, hash(token), expiresAt, ts);
  return { token, expiresAt };
}

/** Consumes a token once. Returns the user id, or null when unknown, used, expired, or the wrong purpose. */
export function consumeToken(db: Db, token: string | undefined, purpose: TokenPurpose): string | null {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = db
    .prepare("SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?")
    .get(hash(token), purpose) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return row.user_id;
}
