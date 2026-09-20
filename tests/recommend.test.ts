import { describe, it, expect } from "vitest";
import { buildRecommendations, topThree, contactBlock, jsonLdCopy, homepageCopy } from "@/lib/recommend/rules";
import { computeRunMetrics } from "@/lib/metrics/compute";
import type { Business } from "@/lib/business/schema";
import { check, mention, citation } from "./analyze.test";

const business: Business = {
  id: "b", userId: "u", name: "Riverside Test Dental", aliases: [], websiteUrl: "https://riverside-test-dental.example/", websiteDomain: "riverside-test-dental.example",
  category: "Dentist", city: "Testville", region: "Test State", country: "US", serviceArea: "Testville and nearby", services: ["teeth cleaning"],
  priorityServices: [], businessType: "unknown", factsConfirmedAt: null, schedule: "off", createdAt: "", updatedAt: "",
};
const q = (id: string, text: string) => check(id, "success", "demo", { questionId: `q${id}`, questionText: text });

describe("suggested copy never invents business facts", () => {
  it("omits hours, phone, and booking when unconfirmed and lists what is missing", () => {
    const c = contactBlock(business);
    expect(c.text).not.toMatch(/Sun closed|Mon.Fri/);
    expect(c.text).toContain("[your phone number]");
    expect(c.needs).toEqual(["street address", "phone number", "opening hours"]);
    const j = jsonLdCopy(business);
    const json = JSON.parse(j.text.slice(j.text.indexOf("{"), j.text.lastIndexOf("}") + 1));
    expect(json.openingHours).toBeUndefined();
    expect(json.telephone).toBeUndefined();
    expect(json.address.streetAddress).toBeUndefined();
    expect(j.needs.join(" ")).toMatch(/telephone/);
    expect(homepageCopy(business).text).not.toContain("book online");
    expect(homepageCopy(business).needs).toEqual(["how customers should contact you"]);
  });
  it("uses confirmed facts and drops the address for a service-area business", () => {
    const confirmed: Business = { ...business, phone: "(555) 123-4567", hours: "Mon–Sat 8am–6pm", businessType: "service_area", bookingUrl: "https://riverside-test-dental.example/book", factsConfirmedAt: "2026-09-20T00:00:00Z" };
    const c = contactBlock(confirmed);
    expect(c.text).toContain("Phone: (555) 123-4567");
    expect(c.text).toContain("Hours: Mon–Sat 8am–6pm");
    expect(c.text).not.toContain("[Street address]");
    expect(c.needs).toEqual([]);
    const j = jsonLdCopy(confirmed);
    const json = JSON.parse(j.text.slice(j.text.indexOf("{"), j.text.lastIndexOf("}") + 1));
    expect(json.telephone).toBe("(555) 123-4567");
    expect(json.address.streetAddress).toBeUndefined();
    expect(json.potentialAction.target).toBe("https://riverside-test-dental.example/book");
    expect(homepageCopy(confirmed).text).toContain("Call us or book online.");
  });
});

describe("buildRecommendations", () => {
  it("puts an unreachable website first and does not claim other tools cannot reach it", () => {
    const metrics = computeRunMetrics([q("1", "Who is the best dentist?")], [], []);
    const recs = buildRecommendations({ business, metrics, citations: [], dataMode: "demo", audit: { id: "a", status: "failed_fetch", pages: [{ url: business.websiteUrl, fetched: false, error: "timed out" }], findings: [] } });
    expect(recs[0].ruleId).toBe("website_unreachable");
    expect(recs[0].evidence.length).toBeGreaterThan(0);
    expect(recs[0].why).not.toMatch(/cannot cite/);
  });

  it("derives actions from findings and observed answers with real evidence references", () => {
    const checks = [q("1", "I need teeth cleaning in Testville. Who should I call?"), q("2", "Best dentist?"), check("3", "failed")];
    const mentions = [mention("2", "Comp", false, "positive")];
    const citations = [citation("1", "dir.example", false), { ...citation("2", "dir.example", false), id: "c2", url: "https://dir.example/x" }];
    const metrics = computeRunMetrics(checks, mentions, citations);
    const findings = [
      { id: "f1", ruleId: "contact.phone", category: "contact" as const, severity: "missing" as const, title: "No phone", detail: "" },
      { id: "f2", ruleId: "location.city", category: "location" as const, severity: "missing" as const, title: "No city", detail: "" },
      { id: "f3", ruleId: "technical.schema", category: "technical" as const, severity: "missing" as const, title: "No schema", detail: "" },
      { id: "f4", ruleId: "services.named", category: "services" as const, severity: "missing" as const, title: "No services", detail: "None of these appear in the page text: teeth cleaning." },
    ];
    const recs = buildRecommendations({ business, metrics, citations, dataMode: "demo", audit: { id: "a", status: "complete", pages: [{ url: "x", fetched: true }], findings } });
    expect(recs.length).toBeGreaterThanOrEqual(5);
    for (const r of recs) expect(r.evidence.length).toBeGreaterThan(0);
    expect(topThree(recs).length).toBe(3);
    const sources = recs.find((r) => r.ruleId === "get_listed_on_cited_sources")!;
    expect(sources.evidence[0]).toMatchObject({ type: "citation", id: "1-dir.example", checkId: "1" });
    expect(sources.why).toContain("We have not checked whether you already appear");
    const contact = recs.find((r) => r.ruleId === "contact_details")!;
    expect(contact.verifyRules).toEqual(["contact.phone"]);
    expect(contact.scope).toBe("contact_details:contact.phone");
    expect(recs.find((r) => r.ruleId === "answer_absent_questions")?.evidence[0].type).toBe("check");
    expect(recs.find((r) => r.ruleId === "service_pages")?.why).not.toMatch(/can only recommend/);
  });

  it("does not ask a service-area business for a street address", () => {
    const metrics = computeRunMetrics([q("1", "x")], [], []);
    const findings = [{ id: "f1", ruleId: "location.address", category: "location" as const, severity: "missing" as const, title: "No address", detail: "" }];
    const recs = buildRecommendations({ business: { ...business, businessType: "service_area" }, metrics, citations: [], dataMode: "live", audit: { id: "a", status: "complete", pages: [], findings } });
    expect(recs.find((r) => r.ruleId === "contact_details")).toBeUndefined();
  });

  it("returns nothing when there is no evidence at all", () => {
    const metrics = computeRunMetrics([check("1", "failed")], [], []);
    expect(buildRecommendations({ business, metrics, citations: [], dataMode: "live", audit: null })).toEqual([]);
  });
});
