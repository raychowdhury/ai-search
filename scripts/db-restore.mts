/** Restores a backup. Stop the app first. Usage: DATABASE_PATH=./data/app.db pnpm db:restore ./backups/app-<stamp>.db */
import path from "node:path";
import { restoreDatabase, verifyBackup } from "@/db/backup";

const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm db:restore <backup-file>");
  process.exit(1);
}
const target = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
console.log(JSON.stringify({ backup: file, check: verifyBackup(file) }, null, 2));
const { replaced } = restoreDatabase(file, target);
console.log(JSON.stringify({ restoredTo: target, previousKeptAs: replaced }, null, 2));
