import { describe, it, expect } from "vitest";
import { openDatabase } from "@/db/client";
import { createUser } from "@/lib/auth/users";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness } from "@/lib/business/repo";
import { suggestQuestions } from "@/lib/questions/suggest";
import { saveQuestionSet, newQuestion } from "@/lib/questions/repo";
import { createRun, getRun, getChecksForRun } from "@/lib/collect/runs";
import { drain } from "@/lib/jobs/worker";
import { mentionsForRun, citationsForRun } from "@/lib/analyze/store";
import { recommendationsForRun, setRecommendationStatus } from "@/lib/recommend/store";
import { computeRunMetrics } from "@/lib/metrics/compute";

describe("end-to-end demo run through the worker", () => {
  it("collects, analyzes, and recommends without fabricating anything", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, businessInputSchema.parse({
      name: "Riverside Test Dental", aliases: [], websiteUrl: "riverside-test-dental.example", category: "Dentist", city: "Testville",
      region: "Test State", country: "US", serviceArea: "Testville and nearby towns", services: ["teeth cleaning", "emergency dental care"],
    }));
    const qs = saveQuestionSet(db, business.id, suggestQuestions(business).map((t) => newQuestion(t, "suggested")));
    const run = createRun(db, business, qs, ["demo"], "demo", { audit: false });
    expect(getChecksForRun(db, run.id).length).toBe(qs.questions.length);

    const jobsRun = await drain({ db, log: () => {}, extractorEnabled: false });
    expect(jobsRun).toBe(2); // run_checks then analyze_run

    const done = getRun(db, run.id)!;
    expect(done.status).toBe("complete");
    const checks = getChecksForRun(db, run.id);
    expect(checks.every((c) => c.status === "success" || c.status === "failed")).toBe(true);
    const failed = checks.filter((c) => c.status === "failed");
    for (const f of failed) expect(f.errorCode).toBe("demo_simulated_outage");

    const mentions = mentionsForRun(db, run.id);
    const citations = citationsForRun(db, run.id);
    // Every mention's evidence must be a real excerpt of the stored answer.
    for (const m of mentions) {
      const check = checks.find((c) => c.id === m.checkId)!;
      expect(check.answerText!.slice(m.evidenceStart, m.evidenceEnd)).toBe(m.evidenceText);
      expect(check.status).toBe("success");
    }
    for (const c of citations) expect(c.url.startsWith("https://")).toBe(true);

    const metrics = computeRunMetrics(checks, mentions, citations);
    expect(metrics.successfulChecks + metrics.failedChecks).toBe(checks.length);
    expect(metrics.mentionRate.denominator).toBe(metrics.successfulChecks);
    expect(done.summary?.competitorExtraction).toBe("demo");
    expect(metrics.competitors.length).toBeGreaterThan(0);

    const recs = recommendationsForRun(db, run.id);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (const r of recs) expect(r.evidence.length).toBeGreaterThan(0);
    expect(setRecommendationStatus(db, recs[0].id, business.id, "done")).toBe(true);
    expect(setRecommendationStatus(db, recs[0].id, "someone-else", "done")).toBe(false);

    // A second run carries the done status forward for the same rule.
    const run2 = createRun(db, business, qs, ["demo"], "demo", { audit: false });
    await drain({ db, log: () => {}, extractorEnabled: false });
    const recs2 = recommendationsForRun(db, run2.id);
    const carried = recs2.find((r) => r.ruleId === recs[0].ruleId);
    if (carried) expect(carried.status).toBe("done");
  });
});
