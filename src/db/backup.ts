import { backup, DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Online backup of the live SQLite file using SQLite's backup API (safe while
 * the app is running, consistent snapshot). Returns the written file path.
 */
export async function backupDatabase(db: DatabaseSync, backupDir: string, prefix = "app"): Promise<string> {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(backupDir, `${prefix}-${stamp}.db`);
  await backup(db, file);
  return file;
}

export interface IntegrityReport {
  ok: boolean;
  integrity: string;
  tables: Record<string, number>;
}

/** Opens a backup read-only and checks it before anyone relies on it. */
export function verifyBackup(file: string): IntegrityReport {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
    const tables: Record<string, number> = {};
    for (const name of ["users", "businesses", "runs", "checks", "mentions", "citations", "audits", "recommendations", "events"]) {
      try {
        tables[name] = (db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get() as { c: number }).c;
      } catch {
        tables[name] = -1;
      }
    }
    return { ok: integrity === "ok", integrity, tables };
  } finally {
    db.close();
  }
}

/**
 * Restores a verified backup over the target path. The app must be stopped:
 * an open connection would keep the old file's pages. The previous file is kept
 * as <target>.replaced-<stamp>.
 */
export function restoreDatabase(backupFile: string, targetPath: string): { replaced: string | null } {
  const report = verifyBackup(backupFile);
  if (!report.ok) throw new Error(`Backup failed integrity check: ${report.integrity}`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  let replaced: string | null = null;
  if (fs.existsSync(targetPath)) {
    replaced = `${targetPath}.replaced-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.renameSync(targetPath, replaced);
  }
  for (const suffix of ["-wal", "-shm"]) if (fs.existsSync(targetPath + suffix)) fs.rmSync(targetPath + suffix);
  fs.copyFileSync(backupFile, targetPath);
  return { replaced };
}

/** Deletes backups older than `keepDays`, keeping at least `keepMin` most recent. */
export function pruneBackups(backupDir: string, keepDays = 14, keepMin = 7): string[] {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const cutoff = Date.now() - keepDays * 24 * 3600 * 1000;
  const removed: string[] = [];
  files.forEach((entry, i) => {
    if (i >= keepMin && entry.t < cutoff) {
      fs.rmSync(path.join(backupDir, entry.f));
      removed.push(entry.f);
    }
  });
  return removed;
}
