/** Backs up the live database. Usage: DATABASE_PATH=./data/app.db BACKUP_DIR=./backups pnpm db:backup */
import path from "node:path";
import { openDatabase } from "@/db/client";
import { backupDatabase, verifyBackup, pruneBackups } from "@/db/backup";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");
const db = openDatabase(dbPath);
const file = await backupDatabase(db, dir);
const report = verifyBackup(file);
console.log(JSON.stringify({ file, ...report, pruned: pruneBackups(dir) }, null, 2));
if (!report.ok) process.exit(1);
