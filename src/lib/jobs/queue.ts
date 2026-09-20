import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";

export type JobType = "run_checks" | "website_audit" | "analyze_run" | "verify_action";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
}

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

export function enqueue(db: Db, type: JobType, payload: Record<string, unknown>, runAfter?: Date): string {
  const id = newId();
  const ts = nowIso();
  db.prepare(
    "INSERT INTO jobs (id, type, payload, status, attempts, run_after, created_at, updated_at) VALUES (?,?,?,?,0,?,?,?)",
  ).run(id, type, JSON.stringify(payload), "queued", (runAfter ?? new Date()).toISOString(), ts, ts);
  return id;
}

/** Atomically claims the next runnable job, including jobs whose lock expired. */
export function claimNext(db: Db, now = new Date()): Job | null {
  const nowStr = now.toISOString();
  const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString();
  const row = db
    .prepare(
      `UPDATE jobs SET status = 'running', locked_at = ?, attempts = attempts + 1, updated_at = ?
       WHERE id = (
         SELECT id FROM jobs
         WHERE (status = 'queued' AND run_after <= ?)
            OR (status = 'running' AND locked_at < ?)
         ORDER BY run_after ASC LIMIT 1
       )
       RETURNING id, type, payload, attempts`,
    )
    .get(nowStr, nowStr, nowStr, staleLock) as { id: string; type: JobType; payload: string; attempts: number } | undefined;
  if (!row) return null;
  return { id: row.id, type: row.type, payload: JSON.parse(row.payload) as Record<string, unknown>, attempts: row.attempts };
}

export function completeJob(db: Db, id: string): void {
  db.prepare("UPDATE jobs SET status = 'done', locked_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function failJob(db: Db, job: Job, error: string, retryable: boolean): void {
  const ts = nowIso();
  if (retryable && job.attempts < MAX_ATTEMPTS) {
    const delayMs = 2000 * 2 ** (job.attempts - 1);
    db.prepare(
      "UPDATE jobs SET status = 'queued', locked_at = NULL, run_after = ?, last_error = ?, updated_at = ? WHERE id = ?",
    ).run(new Date(Date.now() + delayMs).toISOString(), error.slice(0, 500), ts, job.id);
  } else {
    db.prepare("UPDATE jobs SET status = 'failed', locked_at = NULL, last_error = ?, updated_at = ? WHERE id = ?").run(
      error.slice(0, 500),
      ts,
      job.id,
    );
  }
}

export function countPending(db: Db, type?: JobType): number {
  const row = (
    type
      ? db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('queued','running') AND type = ?").get(type)
      : db.prepare("SELECT COUNT(*) AS c FROM jobs WHERE status IN ('queued','running')").get()
  ) as { c: number };
  return row.c;
}
