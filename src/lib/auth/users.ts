import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import { hashPassword, verifyPassword } from "./password";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at?: string | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createUser(db: Db, email: string, password: string): Promise<UserRow> {
  const id = newId();
  const ts = nowIso();
  const password_hash = await hashPassword(password);
  const normalized = normalizeEmail(email);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, normalized, password_hash, ts, ts);
  return { id, email: normalized, password_hash };
}

export function findUserByEmail(db: Db, email: string): UserRow | null {
  const row = db
    .prepare("SELECT id, email, password_hash, email_verified_at FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row ?? null;
}

export function getUserById(db: Db, id: string): UserRow | null {
  const row = db.prepare("SELECT id, email, password_hash, email_verified_at FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ?? null;
}

/** Replaces the password and revokes every session so a reset also logs out other devices. */
export async function setPassword(db: Db, userId: string, password: string): Promise<void> {
  const password_hash = await hashPassword(password);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(password_hash, nowIso(), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function markEmailVerified(db: Db, userId: string): void {
  db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), userId);
}

export async function authenticate(db: Db, email: string, password: string): Promise<UserRow | null> {
  const user = findUserByEmail(db, email);
  if (!user) {
    // Burn comparable time so the response does not reveal whether the email exists.
    await verifyPassword(password, "scrypt$32768$8$1$AAAA$AAAA");
    return null;
  }
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export function deleteUser(db: Db, userId: string): void {
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
