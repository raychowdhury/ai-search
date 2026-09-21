import type { Db } from "@/db/client";
import { nowIso } from "@/lib/ids";

/** Structured JSON log line. Never include answer text, page content, or keys. */
export function logJson(level: "info" | "warn" | "error", event: string, meta: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, at: nowIso(), ...meta });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare("INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(key, value, nowIso());
}

export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export const WORKER_HEARTBEAT_KEY = "worker.heartbeat";
export const WORKER_STALE_MS = 2 * 60 * 1000;

export interface WorkerStatus {
  lastHeartbeatAt: string | null;
  stale: boolean;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
}

export function workerStatus(db: Db): WorkerStatus {
  const hb = getMeta(db, WORKER_HEARTBEAT_KEY);
  const stale = !hb || Date.now() - new Date(hb).getTime() > WORKER_STALE_MS;
  return { lastHeartbeatAt: hb, stale, lastBackupAt: getMeta(db, "backup.lastAt"), lastBackupFile: getMeta(db, "backup.lastFile") };
}

/** Optional webhook for operator alerts (any URL that accepts JSON POST). Fire-and-forget. */
export async function alert(event: string, meta: Record<string, unknown> = {}): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  logJson("error", event, meta);
  if (!url) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, at: nowIso(), ...meta }), signal: AbortSignal.timeout(5000) });
  } catch (err) {
    logJson("warn", "alert.webhook_failed", { error: err instanceof Error ? err.message : String(err) });
  }
}
