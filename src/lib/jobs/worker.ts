import type { Db } from "@/db/client";
import { getDb } from "@/db/client";
import { claimNext, completeJob, failJob, enqueue, type Job } from "./queue";
import { getBusinessById } from "@/lib/business/repo";
import {
  getRun, getChecksForRun, markCheckRunning, markCheckSuccess, markCheckFailed, requeueCheck, setRunStatus, type Check,
} from "@/lib/collect/runs";
import { getAdapter } from "@/lib/platforms/registry";
import { PlatformError } from "@/lib/platforms/types";
import { analyzeRun } from "@/lib/analyze/run";
import { claudeExtractor, isClaudeExtractorConfigured } from "@/lib/analyze/claudeExtractor";
import { computeRunMetrics } from "@/lib/metrics/compute";
import { mentionsForRun, citationsForRun } from "@/lib/analyze/store";
import { runWebsiteAudit, latestAudit } from "@/lib/audit/run";
import { buildRecommendations, topThree } from "@/lib/recommend/rules";
import { saveRecommendations, getRecommendation, setVerification } from "@/lib/recommend/store";
import { logEvent } from "@/lib/events";
import { runScheduler } from "./scheduler";

const MAX_CHECK_ATTEMPTS = 3;
const CHECK_CONCURRENCY = 2;

export interface WorkerDeps {
  db?: Db;
  log?: (msg: string) => void;
  /** Override for tests; defaults to the registry. */
  adapterFor?: typeof getAdapter;
  extractorEnabled?: boolean;
  /** Override for tests so verification does not fetch the network. */
  auditRunner?: typeof runWebsiteAudit;
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
      await (deps.auditRunner ?? runWebsiteAudit)(db, business, runId);
      return;
    }
    case "analyze_run":
      await analyze(db, String(job.payload.runId), deps, log);
      return;
    case "verify_action":
      await verifyAction(db, String(job.payload.recommendationId), deps, log);
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
      const envelope = { provider: answer.raw, citations: answer.citations, ...(answer.demoHints ? { demoHints: answer.demoHints } : {}) };
      const status = markCheckSuccess(db, check.id, { model: answer.model, answerText: answer.answerText, raw: envelope, usage: answer.usage });
      if (status !== "full") log(`check ${check.id}: provider body exceeded the evidence cap; citations kept, body dropped`);
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
  const citations = citationsForRun(db, runId);
  const metrics = computeRunMetrics(checks, mentionsForRun(db, runId), citations);
  const audit = latestAudit(db, business.id, runId) ?? latestAudit(db, business.id);
  const recs = topThree(
    buildRecommendations({
      business,
      metrics,
      citations,
      dataMode: run.dataMode,
      audit: audit ? { id: audit.id, status: audit.status, pages: audit.pages, findings: audit.findings } : null,
    }),
  );
  const saved = saveRecommendations(db, runId, business.id, recs);
  for (const ruleId of saved.recurred) logEvent(db, business.id, "recurrence_detected", { runId, ruleId });
  const notes: string[] = [];
  if (summary.successfulChecks > 0 && summary.competitorExtraction === "unavailable") {
    notes.push("Competitor extraction was unavailable for this check, so only your own business was detected in the answers.");
  } else if (summary.competitorExtraction === "partial") {
    notes.push(`Competitor extraction did not run for ${summary.extractionUnavailable} of ${summary.successfulChecks} answers; competitor counts may be incomplete.`);
  }
  if (summary.evidenceUnreadable > 0) {
    notes.push(`Source evidence could not be read for ${summary.evidenceUnreadable} answer${summary.evidenceUnreadable === 1 ? "" : "s"}; those are left out of the "website cited" count.`);
  }
  setRunStatus(db, runId, "complete", { summary, ...(notes.length ? { analysisNote: notes.join(" ") } : {}) });
}

/**
 * Verifies an action the owner marked done. Audit-based actions re-read the site
 * and check the relevant rules; answer-based actions cannot be verified without a
 * new check and are recorded as such. A failed fetch is "unable to verify", never success.
 */
async function verifyAction(db: Db, recommendationId: string, deps: WorkerDeps, log: (m: string) => void): Promise<void> {
  const rec = getRecommendation(db, recommendationId);
  if (!rec) return;
  const business = getBusinessById(db, rec.businessId);
  if (!business) return;
  if (rec.verifyRules.length === 0) {
    setVerification(db, rec.id, "unable_to_verify", "This action can only be checked by running a new check and reading the answers again.");
    logEvent(db, business.id, "verification_failed", { recommendationId: rec.id, reason: "not_verifiable_by_audit" });
    return;
  }
  const audit = await (deps.auditRunner ?? runWebsiteAudit)(db, business, null);
  if (audit.status !== "complete") {
    setVerification(db, rec.id, "unable_to_verify", `We could not read your website to check this (${audit.pages[0]?.error ?? "unknown reason"}).`);
    logEvent(db, business.id, "verification_failed", { recommendationId: rec.id, reason: "fetch_failed" });
    return;
  }
  const remaining = rec.verifyRules.filter((ruleId) => {
    const finding = audit.findings.find((f) => f.ruleId === ruleId);
    return finding && finding.severity !== "good";
  });
  if (remaining.length === 0) {
    setVerification(db, rec.id, "verified_fixed", `A fresh read of your site no longer shows this issue (${rec.verifyRules.length} check${rec.verifyRules.length === 1 ? "" : "s"} passed).`);
    logEvent(db, business.id, "action_verified", { recommendationId: rec.id, ruleId: rec.ruleId });
  } else {
    const titles = remaining.map((r) => audit.findings.find((f) => f.ruleId === r)?.title ?? r);
    setVerification(db, rec.id, "still_observed", `A fresh read of your site still shows: ${titles.join("; ")}.`);
    logEvent(db, business.id, "verification_failed", { recommendationId: rec.id, reason: "still_observed", remaining });
  }
  log(`verified action ${rec.id}: ${remaining.length === 0 ? "fixed" : "still observed"}`);
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
