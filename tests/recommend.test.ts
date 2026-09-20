import { describe, it, expect } from "vitest";
import { buildRecommendations, topThree } from "@/lib/recommend/rules";
import { computeRunMetrics } from "@/lib/metrics/compute";
import type { Business } from "@/lib/business/schema";
import type { Check } from "@/lib/collect/runs";

const business: Business = {
  id: "b", userId: "u", name: "Riverside Test Dental", aliases: [], websiteUrl: "https://riverside-test-dental.example/", websiteDomain: "riverside-test-dental.example",
  category: "Dentist", city: "Testville", region: "Test State", country: "US", serviceArea: "Testville and nearby", services: ["teeth cleaning"],
  schedule: "off", createdAt: "", updatedAt: "",
};
const check = (id: string, status: Check["status"], q: string): Check => ({
  id, runId: "r", questionId: `q${id}`, questionText: q, platform: "demo", model: null, locationContext: { city: "Testville", region: "Test State", country: "US" },
  status, errorCode: null, errorMessage: null, attempts: 1, requestedAt: null, completedAt: null, answerText: "x", usage: null, dataMode: "demo",
});

describe("buildRecommendations", () => {
  it("puts an unreachable website first and cites evidence", () => {
    const metrics = computeRunMetrics([check("1", "success", "Who is the best dentist?")], [], []);
    const recs = buildRecommendations({ business, metrics, dataMode: "demo", audit: { id: "a", status: "failed_fetch", pages: [{ url: business.websiteUrl, fetched: false, error: "timed out" }], findings: [] } });
    expect(recs[0].ruleId).toBe("website_unreachable");
    expect(recs[0].evidence.length).toBeGreaterThan(0);
  });

  it("derives actions from findings and observed answers, ranked and capped at three", () => {
    const checks = [check("1", "success", "I need teeth cleaning in Testville. Who should I call?"), check("2", "success", "Best dentist?"), check("3", "failed", "x")];
    const mentions = [
      { id: "m1", checkId: "2", name: "Comp", normalizedName: "comp", isOwner: false, isRecommended: true, evidenceText: "Comp", evidenceStart: 0, evidenceEnd: 1, extractionMethod: "demo" as const },
    ];
    const citations = [
      { id: "c1", checkId: "1", url: "https://dir.example/", domain: "dir.example", title: null, isOwnerDomain: false, position: 1 },
      { id: "c2", checkId: "2", url: "https://dir.example/x", domain: "dir.example", title: null, isOwnerDomain: false, position: 1 },
    ];
    const metrics = computeRunMetrics(checks, mentions, citations);
    const findings = [
      { id: "f1", ruleId: "contact.phone", category: "contact" as const, severity: "missing" as const, title: "No phone", detail: "" },
      { id: "f2", ruleId: "location.city", category: "location" as const, severity: "missing" as const, title: "No city", detail: "" },
      { id: "f3", ruleId: "technical.schema", category: "technical" as const, severity: "missing" as const, title: "No schema", detail: "" },
      { id: "f4", ruleId: "services.named", category: "services" as const, severity: "missing" as const, title: "No services", detail: "None of these appear in the page text: teeth cleaning." },
    ];
    const recs = buildRecommendations({ business, metrics, dataMode: "demo", audit: { id: "a", status: "complete", pages: [], findings } });
    expect(recs.length).toBeGreaterThanOrEqual(5);
    for (const r of recs) expect(r.evidence.length).toBeGreaterThan(0);
    const top = topThree(recs);
    expect(top.length).toBe(3);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    expect(recs.find((r) => r.ruleId === "local_business_schema")?.suggestedCopy).toContain("LocalBusiness");
    expect(recs.find((r) => r.ruleId === "answer_absent_questions")?.evidence[0].type).toBe("check");
    expect(recs.find((r) => r.ruleId === "get_listed_on_cited_sources")?.why).toContain("dir.example (2 of 2)");
  });

  it("returns nothing when there is no evidence at all", () => {
    const metrics = computeRunMetrics([check("1", "failed", "x")], [], []);
    expect(buildRecommendations({ business, metrics, dataMode: "live", audit: null })).toEqual([]);
  });
});
