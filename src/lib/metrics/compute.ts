import type { Check } from "@/lib/collect/runs";
import type { CitationRecord, MentionRecord } from "@/lib/analyze/store";
import type { PlatformId } from "@/lib/platforms/types";

/**
 * Metric definitions (see docs/ARCHITECTURE.md section 4). Every rate is
 * "count of successful checks with X" over "successful checks". Failed checks
 * are reported separately and are never in a denominator.
 */
export interface Ratio {
  numerator: number;
  denominator: number;
}

export interface CompetitorStat {
  name: string;
  normalizedName: string;
  mentioned: number;
  recommended: number;
  questionIds: string[];
  checkIds: string[];
}

export interface DomainStat {
  domain: string;
  checks: number;
  isOwnerDomain: boolean;
}

export interface QuestionOutcome {
  questionId: string;
  questionText: string;
  platform: PlatformId;
  checkId: string;
  status: "success" | "failed" | "pending";
  ownerMentioned: boolean;
  ownerRecommended: boolean;
  ownerCited: boolean;
  errorCode: string | null;
}

export interface RunMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  pendingChecks: number;
  mentionRate: Ratio;
  recommendationRate: Ratio;
  /** Denominator excludes successful checks whose source evidence is unreadable. */
  citationRate: Ratio;
  /** Successful checks whose competitor extraction did not run or failed. Competitor counts exclude them from nothing, but the UI must say so. */
  extractionUnavailable: number;
  /** Successful checks whose stored evidence could not be read. */
  evidenceUnreadable: number;
  competitors: CompetitorStat[];
  topDomains: DomainStat[];
  perPlatform: Record<string, { successful: number; failed: number; mentionRate: Ratio; recommendationRate: Ratio; citationRate: Ratio }>;
  questions: QuestionOutcome[];
}

export function computeRunMetrics(checks: Check[], mentions: MentionRecord[], citations: CitationRecord[]): RunMetrics {
  const mentionsByCheck = groupBy(mentions, (m) => m.checkId);
  const citationsByCheck = groupBy(citations, (c) => c.checkId);

  const successful = checks.filter((c) => c.status === "success");
  const failed = checks.filter((c) => c.status === "failed");
  const pending = checks.filter((c) => c.status === "queued" || c.status === "running");

  const ownerMentioned = (c: Check) => (mentionsByCheck.get(c.id) ?? []).some((m) => m.isOwner);
  const ownerRecommended = (c: Check) => (mentionsByCheck.get(c.id) ?? []).some((m) => m.isOwner && m.stance === "positive");
  const ownerCited = (c: Check) => (citationsByCheck.get(c.id) ?? []).some((ci) => ci.isOwnerDomain);
  const evidenceReadable = (c: Check) => c.evidenceStatus !== "unparseable" && c.evidenceStatus !== "missing";
  const withEvidence = successful.filter(evidenceReadable);
  const extractionUnavailable = successful.filter((c) => c.analysisMethod === "name_match" || c.analysisMethod === "failed").length;
  const evidenceUnreadable = successful.length - withEvidence.length;

  const ratio = (subset: Check[], pred: (c: Check) => boolean): Ratio => ({
    numerator: subset.filter(pred).length,
    denominator: subset.length,
  });

  const competitorMap = new Map<string, CompetitorStat>();
  for (const c of successful) {
    const seenInCheck = new Set<string>();
    for (const m of mentionsByCheck.get(c.id) ?? []) {
      if (m.isOwner) continue;
      let stat = competitorMap.get(m.normalizedName);
      if (!stat) {
        stat = { name: m.name, normalizedName: m.normalizedName, mentioned: 0, recommended: 0, questionIds: [], checkIds: [] };
        competitorMap.set(m.normalizedName, stat);
      }
      if (!seenInCheck.has(m.normalizedName)) {
        seenInCheck.add(m.normalizedName);
        stat.mentioned += 1;
        stat.checkIds.push(c.id);
        if (!stat.questionIds.includes(c.questionId)) stat.questionIds.push(c.questionId);
      }
      if (m.stance === "positive" && !seenInCheck.has(`${m.normalizedName}:rec`)) {
        seenInCheck.add(`${m.normalizedName}:rec`);
        stat.recommended += 1;
      }
    }
  }
  const competitors = [...competitorMap.values()].sort((a, b) => b.mentioned - a.mentioned || b.recommended - a.recommended || a.name.localeCompare(b.name));

  const domainMap = new Map<string, DomainStat>();
  for (const c of successful) {
    const seen = new Set<string>();
    for (const ci of citationsByCheck.get(c.id) ?? []) {
      if (seen.has(ci.domain)) continue;
      seen.add(ci.domain);
      const d = domainMap.get(ci.domain) ?? { domain: ci.domain, checks: 0, isOwnerDomain: ci.isOwnerDomain };
      d.checks += 1;
      domainMap.set(ci.domain, d);
    }
  }
  const topDomains = [...domainMap.values()].sort((a, b) => b.checks - a.checks || a.domain.localeCompare(b.domain));

  const perPlatform: RunMetrics["perPlatform"] = {};
  for (const platform of new Set(checks.map((c) => c.platform))) {
    const s = successful.filter((c) => c.platform === platform);
    perPlatform[platform] = {
      successful: s.length,
      failed: failed.filter((c) => c.platform === platform).length,
      mentionRate: ratio(s, ownerMentioned),
      recommendationRate: ratio(s, ownerRecommended),
      citationRate: ratio(s.filter(evidenceReadable), ownerCited),
    };
  }

  const questions: QuestionOutcome[] = checks.map((c) => ({
    questionId: c.questionId,
    questionText: c.questionText,
    platform: c.platform,
    checkId: c.id,
    status: c.status === "success" ? "success" : c.status === "failed" ? "failed" : "pending",
    ownerMentioned: c.status === "success" && ownerMentioned(c),
    ownerRecommended: c.status === "success" && ownerRecommended(c),
    ownerCited: c.status === "success" && ownerCited(c),
    errorCode: c.errorCode,
  }));

  return {
    totalChecks: checks.length,
    successfulChecks: successful.length,
    failedChecks: failed.length,
    pendingChecks: pending.length,
    mentionRate: ratio(successful, ownerMentioned),
    recommendationRate: ratio(successful, ownerRecommended),
    citationRate: ratio(withEvidence, ownerCited),
    extractionUnavailable,
    evidenceUnreadable,
    competitors,
    topDomains,
    perPlatform,
    questions,
  };
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
