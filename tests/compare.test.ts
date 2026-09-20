import { describe, it, expect } from "vitest";
import { comparability, compareRuns } from "@/lib/history/compare";
import type { Run } from "@/lib/collect/runs";
import type { RunMetrics } from "@/lib/metrics/compute";

const base: Run = {
  id: "a", businessId: "b", questionSetId: "q", questionSetVersion: 1, platforms: ["demo"], locationContext: { city: "X", region: "Y", country: "US" },
  dataMode: "demo", status: "complete", startedAt: null, finishedAt: null, summary: null, analysisNote: null, createdAt: "",
};

describe("comparability", () => {
  it("accepts identical setups and explains differences otherwise", () => {
    expect(comparability(base, { ...base, id: "b" }).comparable).toBe(true);
    const r = comparability(base, { ...base, questionSetVersion: 2, dataMode: "live", platforms: ["anthropic"] });
    expect(r.comparable).toBe(false);
    expect(r.differences).toEqual(["different question sets", "different platforms", "one run uses sample data"]);
  });
});

describe("compareRuns", () => {
  const q = (id: string, status: "success" | "failed", mentioned: boolean) => ({
    questionId: id, questionText: `Q${id}`, platform: "demo" as const, checkId: `c${id}`, status, ownerMentioned: mentioned, ownerRecommended: false, ownerCited: false, errorCode: null,
  });
  const m = (questions: RunMetrics["questions"]): RunMetrics => ({
    totalChecks: questions.length, successfulChecks: 0, failedChecks: 0, pendingChecks: 0, mentionRate: { numerator: 0, denominator: 0 },
    recommendationRate: { numerator: 0, denominator: 0 }, citationRate: { numerator: 0, denominator: 0 }, competitors: [], topDomains: [], perPlatform: {}, questions,
  });
  it("marks gained, lost, same, and unknown for failed checks", () => {
    const out = compareRuns(m([q("1", "success", false), q("2", "success", true), q("3", "success", true), q("4", "failed", false)]), m([q("1", "success", true), q("2", "success", false), q("3", "success", true), q("4", "success", true)]));
    expect(out.map((c) => c.change)).toEqual(["gained", "lost", "same", "unknown"]);
  });
});
