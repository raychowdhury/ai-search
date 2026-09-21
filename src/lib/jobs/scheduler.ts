import type { Db } from "@/db/client";
import { getBusinessById } from "@/lib/business/repo";
import { getCurrentQuestionSet } from "@/lib/questions/repo";
import { createRun, latestRun, countActiveRuns, countLiveRunsLastDay } from "@/lib/collect/runs";
import { configuredLiveAdapters } from "@/lib/platforms/registry";
import { buildFingerprint } from "@/lib/collect/fingerprint";
import { isExtractorConfigured } from "@/lib/analyze/extractorSelect";
import { LIVE_RUNS_PER_DAY } from "@/lib/collect/limits";
import { logEvent } from "@/lib/events";
import { wouldExceedCap } from "@/lib/platforms/usage";

const INTERVALS: Record<string, number> = { weekly: 7 * 24 * 3600 * 1000, monthly: 30 * 24 * 3600 * 1000 };

export interface SchedulerDeps {
  now?: Date;
  liveAdapterIds?: () => Array<"anthropic" | "openai" | "perplexity" | "gemini">;
  extractorConfigured?: boolean;
  liveRunsPerDay?: number;
  log?: (event: string, meta: Record<string, unknown>) => void;
}

/**
 * Enqueues scheduled re-checks using each business's current question set and
 * stored location context. Scheduled runs obey the same controls as manual ones:
 * no overlap with an active run, the daily live-run cap, and a run_started event.
 * The owner's confirmation is the schedule setting itself (off by default).
 */
export function runScheduler(db: Db, deps: SchedulerDeps = {}): number {
  const now = deps.now ?? new Date();
  const live = deps.liveAdapterIds ? deps.liveAdapterIds() : configuredLiveAdapters().map((a) => a.id as "anthropic" | "openai" | "perplexity" | "gemini");
  const cap = deps.liveRunsPerDay ?? LIVE_RUNS_PER_DAY;
  const log = deps.log ?? (() => undefined);
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
    if (countActiveRuns(db, id) > 0) {
      log("scheduler.skip", { businessId: id, reason: "active_run" });
      continue;
    }
    if (countLiveRunsLastDay(db, id) >= cap) {
      log("scheduler.skip", { businessId: id, reason: "daily_cap", cap });
      continue;
    }
    const qs = getCurrentQuestionSet(db, id);
    if (!qs) continue;
    const allowed = live.filter((p) => !wouldExceedCap(db, p, qs.questions.length));
    if (allowed.length === 0) {
      log("scheduler.skip", { businessId: id, reason: "monthly_cap", platforms: live });
      continue;
    }
    const run = createRun(db, business, qs, allowed, "live", {
      fingerprint: buildFingerprint(allowed, "live", deps.extractorConfigured ?? isExtractorConfigured()),
    });
    logEvent(db, id, "run_started", { runId: run.id, dataMode: "live", platforms: allowed, scheduled: true, schedule: business.schedule });
    log("scheduler.started", { businessId: id, runId: run.id });
    started++;
  }
  return started;
}
