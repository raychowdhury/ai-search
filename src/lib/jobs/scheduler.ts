import type { Db } from "@/db/client";
import { getBusinessById } from "@/lib/business/repo";
import { getCurrentQuestionSet } from "@/lib/questions/repo";
import { createRun, latestRun, countActiveRuns } from "@/lib/collect/runs";
import { configuredLiveAdapters } from "@/lib/platforms/registry";

const INTERVALS: Record<string, number> = { weekly: 7 * 24 * 3600 * 1000, monthly: 30 * 24 * 3600 * 1000 };

/**
 * Enqueues scheduled re-checks using each business's current question set and
 * stored location context. Only live platforms are scheduled; demo runs are manual.
 */
export function runScheduler(db: Db, now = new Date()): number {
  const live = configuredLiveAdapters().map((a) => a.id);
  if (live.length === 0) return 0;
  const rows = db.prepare("SELECT id FROM businesses WHERE schedule IN ('weekly','monthly')").all() as unknown as { id: string }[];
  let started = 0;
  for (const { id } of rows) {
    const business = getBusinessById(db, id);
    if (!business) continue;
    const interval = INTERVALS[business.schedule];
    if (!interval) continue;
    const last = latestRun(db, id);
    if (last && now.getTime() - new Date(last.createdAt).getTime() < interval) continue;
    if (countActiveRuns(db, id) > 0) continue;
    const qs = getCurrentQuestionSet(db, id);
    if (!qs) continue;
    createRun(db, business, qs, live, "live");
    started++;
  }
  return started;
}
