import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth";
import { getBusinessForUser } from "@/lib/business/repo";
import type { Business } from "@/lib/business/schema";
import { getRun, getChecksForRun, type Run, type Check } from "@/lib/collect/runs";
import { mentionsForRun, citationsForRun, type MentionRecord, type CitationRecord } from "@/lib/analyze/store";
import { computeRunMetrics, type RunMetrics } from "@/lib/metrics/compute";
import { recommendationsForRun, type StoredRecommendation } from "@/lib/recommend/store";
import { latestAudit, type StoredAudit } from "@/lib/audit/run";
import { getQuestionSetById, type QuestionSet } from "@/lib/questions/repo";

export async function requireBusiness(): Promise<{ userId: string; business: Business }> {
  const user = await requireUser();
  const business = getBusinessForUser(getDb(), user.id);
  if (!business) redirect("/onboarding");
  return { userId: user.id, business };
}

export interface RunReport {
  run: Run;
  checks: Check[];
  mentions: MentionRecord[];
  citations: CitationRecord[];
  metrics: RunMetrics;
  recommendations: StoredRecommendation[];
  audit: StoredAudit | null;
  questionSet: QuestionSet | null;
}

/** Loads everything a report screen needs, verifying the run belongs to the current business. */
export function loadRunReport(business: Business, runId: string): RunReport {
  const db = getDb();
  const run = getRun(db, runId);
  if (!run || run.businessId !== business.id) notFound();
  const checks = getChecksForRun(db, runId);
  const mentions = mentionsForRun(db, runId);
  const citations = citationsForRun(db, runId);
  return {
    run,
    checks,
    mentions,
    citations,
    metrics: computeRunMetrics(checks, mentions, citations),
    recommendations: recommendationsForRun(db, runId),
    audit: latestAudit(db, business.id, runId) ?? latestAudit(db, business.id),
    questionSet: getQuestionSetById(db, run.questionSetId),
  };
}
