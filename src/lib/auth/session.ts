import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";

export const SESSION_COOKIE = "aivc_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(db: Db, userId: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const ts = nowIso();
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(newId(), userId, hashToken(token), expiresAt.toISOString(), ts, ts);
  return { token, expiresAt };
}

export function findUserBySessionToken(db: Db, token: string | undefined): SessionUser | null {
  if (!token || token.length !== 64) return null;
  const row = db
    .prepare(
      `SELECT u.id AS id, u.email AS email, s.expires_at AS expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as { id: string; email: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }
  return { id: row.id, email: row.email };
}

export function deleteSession(db: Db, token: string | undefined): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}
