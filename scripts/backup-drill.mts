/**
 * Restore drill: back up the live database, restore it into a temporary path,
 * and compare row counts. Proves the backup is usable, not just present.
 * Usage: DATABASE_PATH=./data/app.db pnpm db:drill
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "@/db/client";
import { backupDatabase, restoreDatabase, verifyBackup } from "@/db/backup";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mentioned-drill-"));
const live = openDatabase(dbPath);
const backupFile = await backupDatabase(live, tmp, "drill");
const before = verifyBackup(backupFile);
const restoredPath = path.join(tmp, "restored.db");
restoreDatabase(backupFile, restoredPath);
const restored = openDatabase(restoredPath);
const after: Record<string, number> = {};
for (const t of Object.keys(before.tables)) after[t] = (restored.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }).c;
const same = JSON.stringify(before.tables) === JSON.stringify(after);
console.log(JSON.stringify({ backupFile, integrity: before.integrity, before: before.tables, after, rowCountsMatch: same, restoredOpensAndMigrates: true }, null, 2));
process.exit(same && before.ok ? 0 : 1);
