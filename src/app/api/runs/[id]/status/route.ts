import { getDb } from "@/db/client";
import { getCurrentUser } from "@/server/auth";
import { getBusinessForUser } from "@/lib/business/repo";
import { getRun, getChecksForRun } from "@/lib/collect/runs";
import { latestAudit } from "@/lib/audit/run";
import { PLATFORM_LABELS } from "@/lib/platforms/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  const run = getRun(db, id);
  if (!business || !run || run.businessId !== business.id) return Response.json({ error: "not_found" }, { status: 404 });
  const checks = getChecksForRun(db, id).map((c) => ({
    id: c.id,
    questionText: c.questionText,
    platform: PLATFORM_LABELS[c.platform],
    status: c.status,
    errorCode: c.errorCode,
  }));
  const audit = latestAudit(db, business.id, id);
  return Response.json({ status: run.status, dataMode: run.dataMode, checks, audit: audit?.status ?? "queued" });
}
