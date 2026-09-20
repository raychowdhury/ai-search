import { describe, it, expect } from "vitest";
import { openDatabase } from "@/db/client";
import { createUser } from "@/lib/auth/users";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness } from "@/lib/business/repo";
import { suggestQuestionsDetailed } from "@/lib/questions/suggest";
import { saveQuestionSet, suggestedQuestionSet } from "@/lib/questions/repo";
import { createRun, getRun, getChecksForRun, markCheckSuccess, getCheckRaw, RAW_EVIDENCE_CAP } from "@/lib/collect/runs";
import { buildFingerprint } from "@/lib/collect/fingerprint";
import { drain } from "@/lib/jobs/worker";
import { enqueue } from "@/lib/jobs/queue";
import { mentionsForRun, citationsForRun } from "@/lib/analyze/store";
import { recommendationsForRun, setRecommendationStatus, setVerification } from "@/lib/recommend/store";
import { computeRunMetrics } from "@/lib/metrics/compute";
import { listEvents } from "@/lib/events";
import type { runWebsiteAudit } from "@/lib/audit/run";
import type { Finding } from "@/lib/audit/rules";

const input = businessInputSchema.parse({
  name: "Riverside Test Dental", aliases: [], websiteUrl: "riverside-test-dental.example", category: "Dentist", city: "Testville",
  region: "Test State", country: "US", serviceArea: "Testville and nearby towns", services: ["teeth cleaning", "emergency dental care"],
});

function fakeAudit(findings: Array<Finding & { id?: string }>, status: "complete" | "failed_fetch" = "complete"): typeof runWebsiteAudit {
  return async (db, business, runId) => {
    const id = `audit-${Math.random().toString(36).slice(2, 8)}`;
    const ts = new Date().toISOString();
    db.prepare("INSERT INTO audits (id, business_id, run_id, status, data_mode, pages, finished_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, business.id, runId, status, "live", JSON.stringify([{ url: business.websiteUrl, fetched: status === "complete", error: status === "complete" ? undefined : "timed out" }]), ts, ts, ts);
    if (status === "complete") {
      const ins = db.prepare("INSERT INTO audit_findings (id, audit_id, rule_id, category, severity, title, detail, evidence, page_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
      for (const f of findings) ins.run(`${id}-${f.ruleId}`, id, f.ruleId, f.category, f.severity, f.title, f.detail, null, null, ts);
    }
    return { auditId: id, status, pages: [{ url: business.websiteUrl, fetched: status === "complete", error: status === "complete" ? undefined : "timed out" }], findings: status === "complete" ? findings : [] };
  };
}

describe("end-to-end demo run through the worker", () => {
  it("collects, analyzes, and recommends without fabricating anything", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, input);
    const qs = saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    const run = createRun(db, business, qs, ["demo"], "demo", { audit: false, fingerprint: buildFingerprint(["demo"], "demo", false) });
    expect(getChecksForRun(db, run.id).length).toBe(qs.questions.length);
    expect(getRun(db, run.id)?.fingerprint?.collection).toBe("demo");

    const jobsRun = await drain({ db, log: () => {}, extractorEnabled: false });
    expect(jobsRun).toBe(2);

    const done = getRun(db, run.id)!;
    expect(done.status).toBe("complete");
    const checks = getChecksForRun(db, run.id);
    expect(checks.every((c) => c.status === "success" || c.status === "failed")).toBe(true);
    for (const c of checks.filter((c) => c.status === "failed")) expect(c.errorCode).toBe("demo_simulated_outage");
    for (const c of checks.filter((c) => c.status === "success")) expect(c.analysisMethod).toBe("demo");

    const mentions = mentionsForRun(db, run.id);
    const citations = citationsForRun(db, run.id);
    for (const m of mentions) {
      const check = checks.find((c) => c.id === m.checkId)!;
      expect(check.answerText!.slice(m.evidenceStart, m.evidenceEnd)).toBe(m.evidenceText);
      expect(check.status).toBe("success");
      expect(["positive", "negative", "neutral", "unknown"]).toContain(m.stance);
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

    // A second run carries "done" forward only for the same scope, and flags recurrence.
    const run2 = createRun(db, business, qs, ["demo"], "demo", { audit: false });
    await drain({ db, log: () => {}, extractorEnabled: false });
    const carried = recommendationsForRun(db, run2.id).find((r) => r.ruleId === recs[0].ruleId);
    if (carried && carried.scope === recs[0].scope) {
      expect(carried.status).toBe("done");
      expect(carried.verificationStatus).toBe("recurred");
      expect(listEvents(db, business.id).some((e) => e.type === "recurrence_detected")).toBe(true);
    }
  });

  it("keeps citations and marks evidence truncated when a provider body exceeds the cap", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, input);
    const qs = saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    const run = createRun(db, business, qs, ["demo"], "demo", { audit: false });
    const check = getChecksForRun(db, run.id)[0];
    const status = markCheckSuccess(db, check.id, {
      model: "m", answerText: "Riverside Test Dental is great.",
      raw: { provider: { huge: "x".repeat(RAW_EVIDENCE_CAP + 10) }, citations: [{ url: "https://riverside-test-dental.example/", title: "Home" }] },
    });
    expect(status).toBe("provider_truncated");
    const stored = JSON.parse(getCheckRaw(db, check.id)!);
    expect(stored.providerTruncated).toBe(true);
    expect(stored.citations.length).toBe(1);
    expect(getChecksForRun(db, run.id)[0].evidenceStatus).toBe("provider_truncated");
  });

  it("treats damaged historical evidence as unreadable, not as zero citations", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, input);
    const qs = saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    const run = createRun(db, business, qs, ["demo"], "demo", { audit: false });
    const [c1, c2] = getChecksForRun(db, run.id);
    markCheckSuccess(db, c1.id, { model: "m", answerText: "Nothing named here.", raw: { provider: null, citations: [] } });
    markCheckSuccess(db, c2.id, { model: "m", answerText: "Nothing named here either.", raw: { provider: null, citations: [] } });
    db.prepare("UPDATE checks SET raw_response = ? WHERE id = ?").run('{"provider":{"trunc', c2.id);
    for (const c of getChecksForRun(db, run.id).slice(2)) db.prepare("UPDATE checks SET status = 'failed', error_code = 'x' WHERE id = ?").run(c.id);
    enqueue(db, "analyze_run", { runId: run.id });
    await drain({ db, log: () => {}, extractorEnabled: false });
    const after = getChecksForRun(db, run.id);
    expect(after.find((c) => c.id === c1.id)?.evidenceStatus).toBe("full");
    expect(after.find((c) => c.id === c2.id)?.evidenceStatus).toBe("unparseable");
    const done = getRun(db, run.id)!;
    expect(done.summary?.evidenceUnreadable).toBe(1);
    expect(done.analysisNote).toMatch(/could not be read/);
    const metrics = computeRunMetrics(after, mentionsForRun(db, run.id), citationsForRun(db, run.id));
    expect(metrics.citationRate.denominator).toBe(1);
  });
});

describe("verification of a done action", () => {
  async function setup(findings: Parameters<typeof fakeAudit>[0], status: "complete" | "failed_fetch" = "complete") {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, input);
    const qs = saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    const missingPhone = fakeAudit([{ id: "f", ruleId: "contact.phone", category: "contact", severity: "missing", title: "No phone number found", detail: "" }]);
    const run = createRun(db, business, qs, ["demo"], "demo", { audit: true });
    await drain({ db, log: () => {}, extractorEnabled: false, auditRunner: missingPhone });
    const rec = recommendationsForRun(db, run.id).find((r) => r.ruleId === "contact_details")!;
    expect(rec).toBeDefined();
    setRecommendationStatus(db, rec.id, business.id, "done");
    setVerification(db, rec.id, "queued", null);
    enqueue(db, "verify_action", { recommendationId: rec.id });
    await drain({ db, log: () => {}, extractorEnabled: false, auditRunner: fakeAudit(findings, status) });
    return { db, business, rec: recommendationsForRun(db, run.id).find((r) => r.id === rec.id)! };
  }

  it("marks verified fixed only when a fresh read no longer shows the issue", async () => {
    const { rec, db, business } = await setup([{ id: "g", ruleId: "contact.phone", category: "contact", severity: "good", title: "Phone number is easy to find", detail: "" }]);
    expect(rec.status).toBe("done");
    expect(rec.verificationStatus).toBe("verified_fixed");
    expect(listEvents(db, business.id).some((e) => e.type === "action_verified")).toBe(true);
  });
  it("reports still observed when the finding persists", async () => {
    const { rec } = await setup([{ id: "g", ruleId: "contact.phone", category: "contact", severity: "missing", title: "No phone number found", detail: "" }]);
    expect(rec.verificationStatus).toBe("still_observed");
    expect(rec.verificationNote).toMatch(/still shows/);
  });
  it("leaves verification unknown when the site cannot be fetched", async () => {
    const { rec } = await setup([], "failed_fetch");
    expect(rec.verificationStatus).toBe("unable_to_verify");
  });
});
