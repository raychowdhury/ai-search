import { getDb } from "@/db/client";
import { platformHealth } from "@/server/platformHealth";
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
    // Key present is not proof the integration works; lastSuccessAt is.
    platforms: dbOk ? platformHealth(getDb()) : [],
    competitorExtraction: isClaudeExtractorConfigured() ? "configured" : "unavailable",
  });
}
