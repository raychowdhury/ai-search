import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import { hashPassword, verifyPassword } from "./password";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
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
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row ?? null;
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
