import type { Run } from "@/lib/collect/runs";
import type { RunMetrics, QuestionOutcome } from "@/lib/metrics/compute";

export interface Comparability {
  comparable: boolean;
  differences: string[];
  /** True when one or both runs predate measurement fingerprints, so configuration changes cannot be ruled out. */
  legacy: boolean;
}

/**
 * Two runs are comparable only when questions, platforms, location context, data
 * mode, and the measurement fingerprint (models, extraction version, prompt
 * template) all match. A configuration change is not a change in the business.
 */
export function comparability(a: Run, b: Run): Comparability {
  const differences: string[] = [];
  if (a.questionSetVersion !== b.questionSetVersion) differences.push("different question sets");
  const pa = [...a.platforms].sort().join(",");
  const pb = [...b.platforms].sort().join(",");
  if (pa !== pb) differences.push("different platforms");
  if (JSON.stringify(a.locationContext) !== JSON.stringify(b.locationContext)) differences.push("different location context");
  if (a.dataMode !== b.dataMode) differences.push("one run uses sample data");
  if (a.status !== "complete" || b.status !== "complete") differences.push("a run is not complete");
  const legacy = !a.fingerprint || !b.fingerprint;
  if (!legacy && JSON.stringify(a.fingerprint) !== JSON.stringify(b.fingerprint)) {
    const fa = a.fingerprint!;
    const fb = b.fingerprint!;
    if (JSON.stringify(fa.models) !== JSON.stringify(fb.models)) differences.push("different models");
    if (fa.extractionVersion !== fb.extractionVersion || fa.extractionModel !== fb.extractionModel) differences.push("different analysis settings");
    if (fa.promptTemplate !== fb.promptTemplate) differences.push("different question wording template");
    if (differences.length === 0) differences.push("different measurement settings");
  }
  return { comparable: differences.length === 0, differences, legacy };
}

export interface QuestionChange {
  questionId: string;
  questionText: string;
  platform: string;
  before: QuestionOutcome | null;
  after: QuestionOutcome | null;
  change: "gained" | "lost" | "same" | "unknown";
}

/** Per-question changes between an earlier and a later run. Failed checks yield "unknown", never "lost". These are observations, not trends. */
export function compareRuns(earlier: RunMetrics, later: RunMetrics): QuestionChange[] {
  const key = (q: QuestionOutcome) => `${q.questionId}|${q.platform}`;
  const before = new Map(earlier.questions.map((q) => [key(q), q]));
  const after = new Map(later.questions.map((q) => [key(q), q]));
  const keys = new Set([...before.keys(), ...after.keys()]);
  const out: QuestionChange[] = [];
  for (const k of keys) {
    const b = before.get(k) ?? null;
    const a = after.get(k) ?? null;
    let change: QuestionChange["change"] = "unknown";
    if (b && a && b.status === "success" && a.status === "success") {
      change = b.ownerMentioned === a.ownerMentioned ? "same" : a.ownerMentioned ? "gained" : "lost";
    }
    out.push({ questionId: (a ?? b)!.questionId, questionText: (a ?? b)!.questionText, platform: (a ?? b)!.platform, before: b, after: a, change });
  }
  return out.sort((x, y) => x.questionText.localeCompare(y.questionText));
}
