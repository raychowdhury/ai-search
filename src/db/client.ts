import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";

export type Db = DatabaseSync;

export function openDatabase(filePath: string): Db {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  runMigrations(db);
  return db;
}

export function runMigrations(db: Db): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        m.version,
        m.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

// One shared connection per process. Stored on globalThis so Next.js dev
// hot reloads do not open a new file handle on every change.
const globalKey = "__aivc_db__";
type GlobalWithDb = typeof globalThis & { [globalKey]?: Db };

export function getDb(): Db {
  const g = globalThis as GlobalWithDb;
  if (!g[globalKey]) {
    const filePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
    g[globalKey] = openDatabase(filePath);
  }
  return g[globalKey];
}
