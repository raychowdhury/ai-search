import type { Db } from "@/db/client";
import type { Business } from "@/lib/business/schema";
import { getChecksForRun, getCheckRaw, type Check, type RunSummary } from "@/lib/collect/runs";
import { findNameMatches, looksRecommended, evidenceWindow, normalizeName } from "./names";
import { normalizeCitations } from "./citations";
import { verifyExtraction, type Extractor, type ExtractedBusinesses } from "./extract";
import { locateExcerpt } from "./verify";
import { replaceMentions, replaceCitations, mentionsForRun, citationsForRun, type MentionRecord } from "./store";
import { computeRunMetrics } from "@/lib/metrics/compute";
import type { DemoEntityHint, PlatformCitation } from "@/lib/platforms/types";

export interface AnalyzeDeps {
  /** Present when an analysis model is configured. */
  extractor?: Extractor;
  log?: (msg: string) => void;
}

interface StoredAnswer {
  citations: PlatformCitation[];
  demoHints?: DemoEntityHint[];
}

/** The collector stores this envelope in raw_response so analysis can be re-run offline. */
export interface RawEnvelope {
  provider: unknown;
  citations: PlatformCitation[];
  demoHints?: DemoEntityHint[];
}

function readEnvelope(rawJson: string | null): StoredAnswer {
  if (!rawJson) return { citations: [] };
  try {
    const parsed = JSON.parse(rawJson) as Partial<RawEnvelope>;
    return {
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      demoHints: Array.isArray(parsed.demoHints) ? parsed.demoHints : undefined,
    };
  } catch {
    return { citations: [] };
  }
}

type Method = MentionRecord["extractionMethod"];

export async function analyzeCheck(db: Db, business: Business, check: Check, deps: AnalyzeDeps): Promise<Method> {
  const answer = check.answerText ?? "";
  const envelope = readEnvelope(getCheckRaw(db, check.id));
  const ownerNames = [business.name, ...business.aliases];
  const ownerNormalized = new Set(ownerNames.map(normalizeName));

  const mentions: Omit<MentionRecord, "id" | "checkId">[] = [];
  let method: Method = "name_match";

  // 1. Owner detection by deterministic name matching. Always runs.
  const ownerMatches = findNameMatches(answer, ownerNames);
  for (const m of ownerMatches) {
    const ev = evidenceWindow(answer, m);
    mentions.push({
      name: business.name,
      normalizedName: normalizeName(business.name),
      isOwner: true,
      isRecommended: looksRecommended(answer, m),
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
        recommended: h.recommended,
        evidence: evidenceForName(answer, h.name),
      })),
    };
  } else if (deps.extractor) {
    method = "llm";
    try {
      extracted = await deps.extractor(answer);
    } catch (err) {
      deps.log?.(`extractor failed for check ${check.id}: ${err instanceof Error ? err.message : String(err)}`);
      method = "name_match";
    }
  }

  if (extracted) {
    for (const e of verifyExtraction(answer, extracted)) {
      const isOwner = ownerNormalized.has(e.normalizedName) || ownerNames.some((n) => findNameMatches(e.name, [n]).length > 0);
      if (isOwner) {
        // Prefer the extractor's recommendation judgement over the heuristic.
        const existing = mentions.find((m) => m.isOwner);
        if (existing) existing.isRecommended = e.recommended;
        continue;
      }
      mentions.push({
        name: e.name,
        normalizedName: e.normalizedName,
        isOwner: false,
        isRecommended: e.recommended,
        evidenceText: e.evidenceText,
        evidenceStart: e.evidenceStart,
        evidenceEnd: e.evidenceEnd,
        extractionMethod: method,
      });
    }
  }

  replaceMentions(db, check.id, mentions);
  replaceCitations(db, check.id, normalizeCitations(envelope.citations, business.websiteDomain));
  return method;
}

function evidenceForName(answer: string, name: string): string {
  const matches = findNameMatches(answer, [name]);
  if (!matches.length) return "";
  return evidenceWindow(answer, matches[0]).text;
}

export async function analyzeRun(db: Db, business: Business, runId: string, deps: AnalyzeDeps): Promise<RunSummary> {
  const checks = getChecksForRun(db, runId);
  const methods = new Set<Method>();
  for (const check of checks) {
    if (check.status !== "success") continue;
    methods.add(await analyzeCheck(db, business, check, deps));
  }
  const metrics = computeRunMetrics(checks, mentionsForRun(db, runId), citationsForRun(db, runId));
  const competitorExtraction: RunSummary["competitorExtraction"] = methods.has("llm")
    ? "llm"
    : methods.has("demo")
      ? "demo"
      : "unavailable";
  return {
    totalChecks: metrics.totalChecks,
    successfulChecks: metrics.successfulChecks,
    failedChecks: metrics.failedChecks,
    ownerMentioned: metrics.mentionRate.numerator,
    ownerRecommended: metrics.recommendationRate.numerator,
    ownerCited: metrics.citationRate.numerator,
    competitorExtraction,
  };
}

export { locateExcerpt };
