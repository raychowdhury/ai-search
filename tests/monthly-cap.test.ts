import { describe, it, expect, vi, afterEach } from "vitest";
import { openDatabase } from "@/db/client";
import { recordProviderCall, callsThisMonth, monthlyCap, capStatus, wouldExceedCap } from "@/lib/platforms/usage";
import { createUser } from "@/lib/auth/users";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness, setSchedule } from "@/lib/business/repo";
import { saveQuestionSet, suggestedQuestionSet } from "@/lib/questions/repo";
import { suggestQuestionsDetailed } from "@/lib/questions/suggest";
import { createRun, getChecksForRun } from "@/lib/collect/runs";
import { drain } from "@/lib/jobs/worker";
import { runScheduler } from "@/lib/jobs/scheduler";
import { demoAdapter } from "@/lib/platforms/demo";
import type { PlatformAdapter } from "@/lib/platforms/types";

afterEach(() => vi.unstubAllEnvs());

describe("monthly provider cap", () => {
  it("counts calls in the current month, parses caps safely, and defaults Gemini to 5000", () => {
    const db = openDatabase(":memory:");
    expect(monthlyCap("gemini")).toBe(5000);
    expect(monthlyCap("openai")).toBe(0);
    vi.stubEnv("MONTHLY_REQUEST_CAP_OPENAI", "abc");
    expect(monthlyCap("openai")).toBe(0);
    vi.stubEnv("MONTHLY_REQUEST_CAP_GEMINI", "3");
    recordProviderCall(db, "gemini", "answer");
    recordProviderCall(db, "gemini", "extraction");
    db.prepare("INSERT INTO provider_calls (id, provider, kind, at) VALUES ('old','gemini','answer','2020-01-01T00:00:00.000Z')").run();
    expect(callsThisMonth(db, "gemini")).toBe(2);
    expect(wouldExceedCap(db, "gemini", 1)).toBe(false);
    expect(wouldExceedCap(db, "gemini", 2)).toBe(true);
    const st = capStatus(db, "gemini");
    expect(st).toMatchObject({ used: 2, cap: 3, remaining: 1, reached: false });
  });

  it("fails checks with monthly_cap instead of calling the provider once the cap is reached", async () => {
    const db = openDatabase(":memory:");
    vi.stubEnv("MONTHLY_REQUEST_CAP_GEMINI", "2");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, businessInputSchema.parse({ name: "Riverside Test Dental", websiteUrl: "riverside-test-dental.example", category: "Dentist", city: "Testville", region: "TS", country: "US", serviceArea: "Testville", services: ["teeth cleaning"] }));
    const qs = saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)).slice(0, 4));
    let calls = 0;
    const fakeGemini: PlatformAdapter = { ...demoAdapter, id: "gemini", dataMode: "live", isConfigured: () => true, async ask(input) { calls++; return demoAdapter.ask(input, { name: business.name, category: "dentist", city: "Testville", region: "TS", websiteDomain: business.websiteDomain, services: business.services }); } };
    const run = createRun(db, business, qs, ["gemini"], "live", { audit: false });
    await drain({ db, log: () => {}, extractorEnabled: false, adapterFor: () => fakeGemini });
    const checks = getChecksForRun(db, run.id);
    expect(calls).toBeLessThanOrEqual(2);
    expect(checks.filter((c) => c.errorCode === "monthly_cap").length).toBe(checks.length - calls);
    expect(callsThisMonth(db, "gemini")).toBe(2);
  });

  it("scheduler skips a business when its platforms are at the cap", async () => {
    const db = openDatabase(":memory:");
    vi.stubEnv("MONTHLY_REQUEST_CAP_GEMINI", "1");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, businessInputSchema.parse({ name: "Riverside Test Dental", websiteUrl: "riverside-test-dental.example", category: "Dentist", city: "Testville", region: "TS", country: "US", serviceArea: "Testville", services: ["teeth cleaning"] }));
    saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    setSchedule(db, business.id, "weekly");
    const skips: string[] = [];
    expect(runScheduler(db, { liveAdapterIds: () => ["gemini"], extractorConfigured: false, log: (e, m) => skips.push(`${e}:${String(m.reason)}`) })).toBe(0);
    expect(skips).toContain("scheduler.skip:monthly_cap");
  });
});
