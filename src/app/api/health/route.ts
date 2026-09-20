import { getDb } from "@/db/client";
import { adapterStatus } from "@/lib/platforms/registry";
import { isClaudeExtractorConfigured } from "@/lib/analyze/claudeExtractor";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    getDb().prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return Response.json({
    ok: dbOk,
    database: dbOk ? "reachable" : "unreachable",
    platforms: adapterStatus(),
    competitorExtraction: isClaudeExtractorConfigured() ? "configured" : "unavailable",
  });
}
