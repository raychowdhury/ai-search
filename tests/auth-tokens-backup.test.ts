import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "@/db/client";
import { createUser, authenticate, getUserById, setPassword, markEmailVerified } from "@/lib/auth/users";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { createSession, findUserBySessionToken } from "@/lib/auth/session";
import { backupDatabase, verifyBackup, restoreDatabase, pruneBackups } from "@/db/backup";
import { passwordResetMail, verifyEmailMail, logMailer } from "@/lib/email/mailer";
import { setMeta, getMeta, workerStatus } from "@/lib/observability";

describe("single-use auth tokens", () => {
  it("issues, consumes once, rejects reuse, wrong purpose, and garbage", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const { token } = issueToken(db, user.id, "reset");
    expect(consumeToken(db, token, "verify")).toBeNull();
    expect(consumeToken(db, token, "reset")).toBe(user.id);
    expect(consumeToken(db, token, "reset")).toBeNull();
    expect(consumeToken(db, "not-a-token", "reset")).toBeNull();
    expect(consumeToken(db, undefined, "reset")).toBeNull();
  });
  it("issuing a new token invalidates the previous unused one", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const first = issueToken(db, user.id, "verify");
    const second = issueToken(db, user.id, "verify");
    expect(consumeToken(db, first.token, "verify")).toBeNull();
    expect(consumeToken(db, second.token, "verify")).toBe(user.id);
  });
  it("rejects expired tokens", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const { token } = issueToken(db, user.id, "reset");
    db.prepare("UPDATE auth_tokens SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(consumeToken(db, token, "reset")).toBeNull();
  });
});

describe("password reset and verification", () => {
  it("setPassword replaces the password and revokes sessions; verification is recorded", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const { token } = createSession(db, user.id);
    await setPassword(db, user.id, "another-long-pw");
    expect(findUserBySessionToken(db, token)).toBeNull();
    expect(await authenticate(db, "o@example.com", "long-enough-pw")).toBeNull();
    expect(await authenticate(db, "o@example.com", "another-long-pw")).not.toBeNull();
    expect(getUserById(db, user.id)?.email_verified_at ?? null).toBeNull();
    markEmailVerified(db, user.id);
    expect(getUserById(db, user.id)?.email_verified_at).toBeTruthy();
  });
  it("mails carry the link and the log mailer succeeds", async () => {
    expect(passwordResetMail("o@example.com", "a".repeat(64)).text).toContain("/reset-password?token=" + "a".repeat(64));
    expect(verifyEmailMail("o@example.com", "b".repeat(64)).text).toContain("/verify-email?token=" + "b".repeat(64));
    expect((await logMailer.send({ to: "o@example.com", subject: "x", text: "y" })).ok).toBe(true);
  });
});

describe("backup and restore", () => {
  it("backs up a live database, verifies integrity, restores it elsewhere with identical rows, and prunes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mentioned-test-"));
    const livePath = path.join(tmp, "live.db");
    const db = openDatabase(livePath);
    await createUser(db, "o@example.com", "long-enough-pw");
    const file = await backupDatabase(db, path.join(tmp, "backups"));
    const report = verifyBackup(file);
    expect(report.ok).toBe(true);
    expect(report.tables.users).toBe(1);
    const restoredPath = path.join(tmp, "restored.db");
    const { replaced } = restoreDatabase(file, restoredPath);
    expect(replaced).toBeNull();
    const restored = openDatabase(restoredPath);
    expect((restored.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c).toBe(1);
    // Restoring over an existing file keeps the old one.
    const second = restoreDatabase(file, restoredPath);
    expect(second.replaced && fs.existsSync(second.replaced)).toBe(true);
    // A corrupt file is refused.
    const bad = path.join(tmp, "bad.db");
    fs.writeFileSync(bad, "not a database");
    expect(() => restoreDatabase(bad, path.join(tmp, "x.db"))).toThrow();
    expect(pruneBackups(path.join(tmp, "backups"), 0, 0).length).toBe(1);
  });
});

describe("worker heartbeat status", () => {
  it("reports stale until a heartbeat is written", () => {
    const db = openDatabase(":memory:");
    expect(workerStatus(db).stale).toBe(true);
    setMeta(db, "worker.heartbeat", new Date().toISOString());
    expect(workerStatus(db).stale).toBe(false);
    expect(getMeta(db, "worker.heartbeat")).toBeTruthy();
    setMeta(db, "worker.heartbeat", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    expect(workerStatus(db).stale).toBe(true);
  });
});
