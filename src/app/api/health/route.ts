import { getDb } from "@/db/client";
import { platformHealth } from "@/server/platformHealth";
import { isExtractorConfigured } from "@/lib/analyze/extractorSelect";
import { workerStatus } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    getDb().prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const worker = dbOk ? workerStatus(getDb()) : null;
  // The worker is considered down when its heartbeat is older than 2 minutes;
  // /api/health then returns 503 so an uptime monitor can alert.
  const workerOk = Boolean(worker && !worker.stale) || process.env.DISABLE_WORKER === "1";
  return Response.json({
    ok: dbOk && workerOk,
    database: dbOk ? "reachable" : "unreachable",
    worker: worker ? { ...worker, disabled: process.env.DISABLE_WORKER === "1" } : null,
    // Key present is not proof the integration works; lastSuccessAt is.
    platforms: dbOk ? platformHealth(getDb()) : [],
    competitorExtraction: isExtractorConfigured() ? "configured" : "unavailable",
  }, { status: dbOk && workerOk ? 200 : 503 });
}
