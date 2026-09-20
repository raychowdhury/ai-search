import type { Db } from "@/db/client";
import { getDb } from "@/db/client";
import { claimNext, completeJob, failJob, enqueue, type Job } from "./queue";
import { getBusinessById } from "@/lib/business/repo";
import {
  getRun, getChecksForRun, markCheckRunning, markCheckSuccess, markCheckFailed, requeueCheck, setRunStatus, type Check,
} from "@/lib/collect/runs";
import { getAdapter } from "@/lib/platforms/registry";
import { PlatformError } from "@/lib/platforms/types";
import type { RawEnvelope } from "@/lib/analyze/run";
import { analyzeRun } from "@/lib/analyze/run";
import { claudeExtractor, isClaudeExtractorConfigured } from "@/lib/analyze/claudeExtractor";
import { computeRunMetrics } from "@/lib/metrics/compute";
import { mentionsForRun, citationsForRun } from "@/lib/analyze/store";
import { runWebsiteAudit, latestAudit } from "@/lib/audit/run";
import { buildRecommendations, topThree } from "@/lib/recommend/rules";
import { saveRecommendations } from "@/lib/recommend/store";
import { runScheduler } from "./scheduler";

const MAX_CHECK_ATTEMPTS = 3;
const CHECK_CONCURRENCY = 2;

export interface WorkerDeps {
  db?: Db;
  log?: (msg: string) => void;
  /** Override for tests; defaults to the registry. */
  adapterFor?: typeof getAdapter;
  extractorEnabled?: boolean;
}

export async function processJob(job: Job, deps: WorkerDeps = {}): Promise<void> {
  const db = deps.db ?? getDb();
  const log = deps.log ?? ((m: string) => console.log(`[worker] ${m}`));
  switch (job.type) {
    case "run_checks":
      await runChecks(db, String(job.payload.runId), deps, log);
      return;
    case "website_audit": {
      const business = getBusinessById(db, String(job.payload.businessId));
      if (!business) return;
      const runId = job.payload.runId ? String(job.payload.runId) : null;
      await runWebsiteAudit(db, business, runId);
      return;
    }
    case "analyze_run":
      await analyze(db, String(job.payload.runId), deps, log);
      return;
    default:
      throw new Error(`Unknown job type ${String(job.type)}`);
  }
}

async function runChecks(db: Db, runId: string, deps: WorkerDeps, log: (m: string) => void): Promise<void> {
  const run = getRun(db, runId);
  if (!run) return;
  const business = getBusinessById(db, run.businessId);
  if (!business) return;
  setRunStatus(db, runId, "running");
  const adapterFor = deps.adapterFor ?? getAdapter;
  const snapshot = {
    name: business.name, category: business.category, city: business.city, region: business.region,
    websiteDomain: business.websiteDomain, services: business.services,
  };

  const processOne = async (check: Check) => {
    markCheckRunning(db, check.id);
    const adapter = adapterFor(check.platform);
    try {
      const answer = await adapter.ask({ question: check.questionText, location: check.locationContext, business: snapshot });
      const envelope: RawEnvelope = { provider: answer.raw, citations: answer.citations, ...(answer.demoHints ? { demoHints: answer.demoHints } : {}) };
      markCheckSuccess(db, check.id, { model: answer.model, answerText: answer.answerText, raw: envelope, usage: answer.usage });
    } catch (err) {
      const pe = err instanceof PlatformError ? err : new PlatformError("unknown_error", err instanceof Error ? err.message : String(err), false);
      const attempts = check.attempts + 1;
      if (pe.retryable && attempts < MAX_CHECK_ATTEMPTS) {
        log(`check ${check.id} failed (${pe.code}), retrying`);
        await new Promise((r) => setTimeout(r, 1000 * attempts));
        requeueCheck(db, check.id);
      } else {
        markCheckFailed(db, check.id, pe.code, pe.message);
      }
    }
  };

  for (let round = 0; round < MAX_CHECK_ATTEMPTS + 1; round++) {
    const queued = getChecksForRun(db, runId).filter((c) => c.status === "queued");
    if (queued.length === 0) break;
    for (let i = 0; i < queued.length; i += CHECK_CONCURRENCY) {
      await Promise.all(queued.slice(i, i + CHECK_CONCURRENCY).map(processOne));
    }
  }
  // Anything still queued after the retry rounds is recorded as failed, never silently dropped.
  for (const c of getChecksForRun(db, runId)) {
    if (c.status === "queued" || c.status === "running") markCheckFailed(db, c.id, "gave_up", "Check did not complete after retries");
  }
  enqueue(db, "analyze_run", { runId });
}

async function analyze(db: Db, runId: string, deps: WorkerDeps, log: (m: string) => void): Promise<void> {
  const run = getRun(db, runId);
  if (!run) return;
  const business = getBusinessById(db, run.businessId);
  if (!business) return;
  const extractorEnabled = deps.extractorEnabled ?? isClaudeExtractorConfigured();
  const summary = await analyzeRun(db, business, runId, { extractor: extractorEnabled && run.dataMode === "live" ? claudeExtractor : undefined, log });
  const checks = getChecksForRun(db, runId);
  const metrics = computeRunMetrics(checks, mentionsForRun(db, runId), citationsForRun(db, runId));
  const audit = latestAudit(db, business.id, runId) ?? latestAudit(db, business.id);
  const recs = topThree(
    buildRecommendations({
      business,
      metrics,
      dataMode: run.dataMode,
      audit: audit ? { id: audit.id, status: audit.status, pages: audit.pages, findings: audit.findings } : null,
    }),
  );
  saveRecommendations(db, runId, business.id, recs);
  const note =
    summary.competitorExtraction === "unavailable" && summary.successfulChecks > 0
      ? "Competitor extraction was unavailable for this check (no analysis model configured). Only your own business was detected."
      : null;
  setRunStatus(db, runId, "complete", { summary, ...(note ? { analysisNote: note } : {}) });
}

/** Runs one worker tick: claims and processes at most one job. Returns true when a job ran. */
export async function tick(deps: WorkerDeps = {}): Promise<boolean> {
  const db = deps.db ?? getDb();
  const job = claimNext(db);
  if (!job) return false;
  try {
    await processJob(job, deps);
    completeJob(db, job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (deps.log ?? console.error)(`[worker] job ${job.id} (${job.type}) failed: ${message}`);
    failJob(db, job, message, true);
    if (job.type === "run_checks" || job.type === "analyze_run") {
      if (job.attempts >= 3) setRunStatus(db, String(job.payload.runId), "failed");
    }
  }
  return true;
}

/** Drains the queue synchronously (used by tests and scripts). */
export async function drain(deps: WorkerDeps = {}, maxJobs = 50): Promise<number> {
  let n = 0;
  while (n < maxJobs && (await tick(deps))) n++;
  return n;
}

const globalKey = "__aivc_worker_started__";
type G = typeof globalThis & { [globalKey]?: boolean };

/** Starts the in-process polling loop once per process. */
export function startWorker(intervalMs = 1500): void {
  const g = globalThis as G;
  if (g[globalKey]) return;
  g[globalKey] = true;
  let lastSchedule = 0;
  const loop = async () => {
    try {
      const ran = await tick();
      if (Date.now() - lastSchedule > 10 * 60 * 1000) {
        lastSchedule = Date.now();
        runScheduler(getDb());
      }
      setTimeout(loop, ran ? 50 : intervalMs);
    } catch (err) {
      console.error("[worker] loop error", err);
      setTimeout(loop, intervalMs * 4);
    }
  };
  setTimeout(loop, intervalMs);
}
