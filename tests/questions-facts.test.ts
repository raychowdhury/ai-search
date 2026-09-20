import { describe, it, expect } from "vitest";
import { suggestQuestionsDetailed } from "@/lib/questions/suggest";
import { businessInputSchema } from "@/lib/business/schema";
import { runAuditRules } from "@/lib/audit/rules";
import { parsePage } from "@/lib/crawl/parse";

const base = { category: "Plumber", city: "Testville", region: "TS", serviceArea: "Testville and nearby", services: ["drain cleaning", "water heater repair", "leak detection"] };

describe("question suggestions gate availability claims on confirmed facts", () => {
  it("omits weekend and same-day questions unless supported", () => {
    const texts = suggestQuestionsDetailed(base).map((q) => q.text);
    expect(texts.some((t) => /weekend/i.test(t))).toBe(false);
    expect(texts.some((t) => /same-day/i.test(t))).toBe(false);
    expect(texts.length).toBeGreaterThanOrEqual(8);
  });
  it("adds them when hours cover weekends or an emergency service is offered", () => {
    const withHours = suggestQuestionsDetailed({ ...base, hours: "Mon–Sat 8am–6pm" }).map((q) => q.text);
    expect(withHours.some((t) => /weekend/i.test(t))).toBe(true);
    const emergency = suggestQuestionsDetailed({ ...base, services: ["emergency plumbing", "drain cleaning"] });
    expect(emergency.some((q) => q.intent === "availability" && /same-day/i.test(q.text))).toBe(true);
  });
  it("puts priority services first and keeps price and comparison questions", () => {
    const qs = suggestQuestionsDetailed({ ...base, priorityServices: ["leak detection"] });
    const firstService = qs.find((q) => q.intent === "service")!;
    expect(firstService.text).toContain("leak detection");
    expect(qs.some((q) => q.intent === "price")).toBe(true);
    expect(qs.some((q) => q.intent === "comparison")).toBe(true);
    expect(qs.every((q) => q.intent)).toBe(true);
  });
});

describe("business facts validation", () => {
  const valid = { name: "Test Plumbing", websiteUrl: "test-plumbing.example", ...base, country: "US" };
  it("accepts confirmed facts and rejects malformed ones", () => {
    const ok = businessInputSchema.safeParse({ ...valid, phone: "(555) 010-2020", hours: "Mon–Fri 8am–5pm", businessType: "service_area", bookingUrl: "https://test-plumbing.example/book", priorityServices: ["leak detection"] });
    expect(ok.success).toBe(true);
    expect(businessInputSchema.safeParse({ ...valid, phone: "12" }).success).toBe(false);
    expect(businessInputSchema.safeParse({ ...valid, bookingUrl: "http://10.0.0.1/book" }).success).toBe(false);
    const empty = businessInputSchema.parse({ ...valid, phone: "", hours: "" });
    expect(empty.phone).toBeUndefined();
    expect(empty.businessType).toBe("unknown");
  });
});

describe("audit rules use confirmed facts", () => {
  const ctx = { name: "Test Plumbing", aliases: [], city: "Testville", region: "TS", services: ["drain cleaning"], websiteUrl: "https://test-plumbing.example/" };
  const html = (phone: string) => `<html><head><title>Test Plumbing - Testville</title></head><body><h1>Test Plumbing</h1><p>Testville drain cleaning.</p><p>Call ${phone}</p></body></html>`;
  it("flags a phone number that differs from the confirmed one", () => {
    const f = runAuditRules({ ...ctx, phone: "(555) 010-2020" }, [parsePage("https://test-plumbing.example/", html("(555) 999-0000"))]);
    expect(f.find((x) => x.ruleId === "contact.phone")).toMatchObject({ severity: "warn", title: expect.stringMatching(/differs/) });
    const ok = runAuditRules({ ...ctx, phone: "(555) 010-2020" }, [parsePage("https://test-plumbing.example/", html("555-010-2020"))]);
    expect(ok.find((x) => x.ruleId === "contact.phone")?.severity).not.toBe("missing");
  });
  it("does not demand an address from a service-area business", () => {
    const f = runAuditRules({ ...ctx, businessType: "service_area" }, [parsePage("https://test-plumbing.example/", html("555"))]);
    expect(f.find((x) => x.ruleId === "location.address")?.severity).toBe("good");
    const store = runAuditRules({ ...ctx, businessType: "storefront" }, [parsePage("https://test-plumbing.example/", html("555"))]);
    expect(store.find((x) => x.ruleId === "location.address")?.severity).toBe("missing");
  });
  it("marks a script-only site as unable to verify rather than missing everything silently", () => {
    const f = runAuditRules(ctx, [parsePage("https://test-plumbing.example/", "<html><body><div id='app'></div></body></html>")]);
    expect(f.find((x) => x.ruleId === "technical.readable")?.severity).toBe("warn");
    expect(f.find((x) => x.ruleId === "services.named")?.detail).toMatch(/page we read/);
  });
});
