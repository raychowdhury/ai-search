import type { Db } from "@/db/client";
import type { Business } from "@/lib/business/schema";
import { getChecksForRun, getCheckRaw, setCheckAnalysis, type Check, type RunSummary, type AnalysisMethod, type EvidenceStatus, type RawEvidenceEnvelope } from "@/lib/collect/runs";
import { findNameMatches, assessStance, evidenceWindow, normalizeName, type Stance } from "./names";
import { normalizeCitations } from "./citations";
import { verifyExtraction, type Extractor, type ExtractedBusinesses } from "./extract";
import { locateExcerpt } from "./verify";
import { replaceMentions, replaceCitations, mentionsForRun, citationsForRun, type MentionRecord } from "./store";
import { computeRunMetrics } from "@/lib/metrics/compute";
import type { DemoEntityHint, PlatformCitation } from "@/lib/platforms/types";

export type RawEnvelope = RawEvidenceEnvelope;

export interface AnalyzeDeps {
  /** Present when an analysis model is configured. */
  extractor?: Extractor;
  log?: (msg: string) => void;
}

interface StoredAnswer {
  citations: PlatformCitation[];
  demoHints?: DemoEntityHint[];
  /** unparseable: the stored evidence could not be read; missing: nothing stored. */
  evidence: "ok" | "unparseable" | "missing";
}

function readEnvelope(rawJson: string | null): StoredAnswer {
  if (!rawJson) return { citations: [], evidence: "missing" };
  try {
    const parsed = JSON.parse(rawJson) as Partial<RawEvidenceEnvelope>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.citations)) return { citations: [], evidence: "unparseable" };
    return {
      citations: parsed.citations,
      demoHints: Array.isArray(parsed.demoHints) ? parsed.demoHints : undefined,
      evidence: "ok",
    };
  } catch {
    return { citations: [], evidence: "unparseable" };
  }
}

export interface CheckAnalysis {
  method: AnalysisMethod;
  note: string | null;
  evidenceStatus: EvidenceStatus | undefined;
}

export async function analyzeCheck(db: Db, business: Business, check: Check, deps: AnalyzeDeps): Promise<CheckAnalysis> {
  const answer = check.answerText ?? "";
  const envelope = readEnvelope(getCheckRaw(db, check.id));
  const ownerNames = [business.name, ...business.aliases];
  const ownerNormalized = new Set(ownerNames.map(normalizeName));

  const mentions: Omit<MentionRecord, "id" | "checkId" | "isRecommended">[] = [];
  let method: AnalysisMethod = "name_match";
  let note: string | null = null;

  // 1. Owner detection by deterministic name matching. Always runs.
  const ownerMatches = findNameMatches(answer, ownerNames);
  for (const m of ownerMatches) {
    const ev = evidenceWindow(answer, m);
    mentions.push({
      name: business.name,
      normalizedName: normalizeName(business.name),
      isOwner: true,
      stance: assessStance(answer, m),
      evidenceText: ev.text,
      evidenceStart: ev.start,
      evidenceEnd: ev.end,
      extractionMethod: "name_match",
    });
  }

  // 2. Competitor extraction: demo hints (verified) or the LLM extractor (verified).
  let extracted: ExtractedBusinesses | null = null;
  if (check.dataMode === "demo") {
    method = "demo";
    extracted = {
      businesses: (envelope.demoHints ?? []).map((h) => ({
        name: h.name,
        stance: (h.recommended ? "positive" : "neutral") as Stance,
        evidence: evidenceForName(answer, h.name),
      })),
    };
  } else if (deps.extractor) {
    try {
      extracted = await deps.extractor(answer);
      method = "llm";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.log?.(`extractor failed for check ${check.id}: ${message}`);
      method = "failed";
      note = `Competitor extraction failed for this answer (${message.slice(0, 120)}). Only your own business was detected.`;
    }
  } else {
    note = "No analysis model configured; only your own business was detected.";
  }

  if (extracted) {
    for (const e of verifyExtraction(answer, extracted)) {
      const isOwner = ownerNormalized.has(e.normalizedName) || ownerNames.some((n) => findNameMatches(e.name, [n]).length > 0);
      if (isOwner) {
        // The model's stance judgement overrides the heuristic for every owner mention.
        for (const m of mentions) if (m.isOwner) m.stance = e.stance;
        continue;
      }
      mentions.push({
        name: e.name,
        normalizedName: e.normalizedName,
        isOwner: false,
        stance: e.stance,
        evidenceText: e.evidenceText,
        evidenceStart: e.evidenceStart,
        evidenceEnd: e.evidenceEnd,
        extractionMethod: method === "llm" ? "llm" : "demo",
      });
    }
  }

  replaceMentions(db, check.id, mentions);
  replaceCitations(db, check.id, envelope.evidence === "ok" ? normalizeCitations(envelope.citations, business.websiteDomain) : []);
  const evidenceStatus: EvidenceStatus | undefined = envelope.evidence === "ok" ? undefined : envelope.evidence;
  if (envelope.evidence !== "ok") {
    note = [note, "The stored source evidence for this answer could not be read, so citations are unavailable."].filter(Boolean).join(" ");
  }
  setCheckAnalysis(db, check.id, method, note, evidenceStatus);
  return { method, note, evidenceStatus };
}

function evidenceForName(answer: string, name: string): string {
  const matches = findNameMatches(answer, [name]);
  if (!matches.length) return "";
  return evidenceWindow(answer, matches[0]).text;
}

export async function analyzeRun(db: Db, business: Business, runId: string, deps: AnalyzeDeps): Promise<RunSummary> {
  const checks = getChecksForRun(db, runId);
  const methods: AnalysisMethod[] = [];
  let evidenceUnreadable = 0;
  for (const check of checks) {
    if (check.status !== "success") continue;
    const result = await analyzeCheck(db, business, check, deps);
    methods.push(result.method);
    if (result.evidenceStatus === "unparseable" || result.evidenceStatus === "missing") evidenceUnreadable += 1;
  }
  const after = getChecksForRun(db, runId);
  const metrics = computeRunMetrics(after, mentionsForRun(db, runId), citationsForRun(db, runId));
  const llm = methods.filter((m) => m === "llm").length;
  const demo = methods.filter((m) => m === "demo").length;
  const unavailable = methods.filter((m) => m === "name_match" || m === "failed").length;
  const competitorExtraction: RunSummary["competitorExtraction"] =
    methods.length === 0 ? "unavailable" : llm === methods.length ? "llm" : demo === methods.length ? "demo" : llm > 0 || demo > 0 ? "partial" : "unavailable";
  return {
    totalChecks: metrics.totalChecks,
    successfulChecks: metrics.successfulChecks,
    failedChecks: metrics.failedChecks,
    ownerMentioned: metrics.mentionRate.numerator,
    ownerRecommended: metrics.recommendationRate.numerator,
    ownerCited: metrics.citationRate.numerator,
    competitorExtraction,
    extractionUnavailable: unavailable,
    evidenceUnreadable,
  };
}

export { locateExcerpt };
