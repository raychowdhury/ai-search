import type { Run } from "@/lib/collect/runs";
import type { RunMetrics, QuestionOutcome } from "@/lib/metrics/compute";

export interface Comparability {
  comparable: boolean;
  differences: string[];
}

/** Two runs are comparable only when questions, platforms, location context, and data mode all match. */
export function comparability(a: Run, b: Run): Comparability {
  const differences: string[] = [];
  if (a.questionSetVersion !== b.questionSetVersion) differences.push("different question sets");
  const pa = [...a.platforms].sort().join(",");
  const pb = [...b.platforms].sort().join(",");
  if (pa !== pb) differences.push("different platforms");
  if (JSON.stringify(a.locationContext) !== JSON.stringify(b.locationContext)) differences.push("different location context");
  if (a.dataMode !== b.dataMode) differences.push("one run uses sample data");
  if (a.status !== "complete" || b.status !== "complete") differences.push("a run is not complete");
  return { comparable: differences.length === 0, differences };
}

export interface QuestionChange {
  questionId: string;
  questionText: string;
  platform: string;
  before: QuestionOutcome | null;
  after: QuestionOutcome | null;
  change: "gained" | "lost" | "same" | "unknown";
}

/** Per-question changes between an earlier and a later run. Failed checks yield "unknown", never "lost". */
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
