import { describe, it, expect, vi, afterEach } from "vitest";
import { perplexityAdapter } from "@/lib/platforms/perplexity";
import { openaiAdapter } from "@/lib/platforms/openai";
import { parseLiveRunsPerDay, DEFAULT_LIVE_RUNS_PER_DAY } from "@/lib/collect/limits";
import { openDatabase } from "@/db/client";
import { createUser } from "@/lib/auth/users";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness, setSchedule } from "@/lib/business/repo";
import { saveQuestionSet, suggestedQuestionSet } from "@/lib/questions/repo";
import { suggestQuestionsDetailed } from "@/lib/questions/suggest";
import { runScheduler } from "@/lib/jobs/scheduler";
import { listRuns, setRunStatus } from "@/lib/collect/runs";
import { listEvents } from "@/lib/events";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("live adapters never send the business name", () => {
  const question = "Who is a good dentist in Testville?";
  const location = { city: "Testville", region: "TS", country: "US" };

  it("perplexity request body contains only the question and location", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test");
    let body = "";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ model: "sonar", choices: [{ message: { content: "An answer." } }], citations: [] }), { status: 200 });
    }) as typeof fetch;
    await perplexityAdapter.ask({ question, location });
    const parsed = JSON.parse(body);
    expect(parsed.messages[0].content).toBe(question);
    expect(body).not.toMatch(/Riverside|example\.com|services/i);
    expect(parsed.web_search_options.user_location.city).toBe("Testville");
  });

  it("openai request body contains only the question and location", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    let body = "";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ model: "gpt-5-mini", output: [{ type: "message", content: [{ type: "output_text", text: "An answer.", annotations: [] }] }] }), { status: 200 });
    }) as typeof fetch;
    await openaiAdapter.ask({ question, location });
    const parsed = JSON.parse(body);
    expect(parsed.input).toBe(question);
    expect(Object.keys(parsed).sort()).toEqual(["input", "model", "tools"]);
  });
});

describe("live run cap parsing", () => {
  it("falls back to the default on malformed, negative, or empty values", () => {
    expect(parseLiveRunsPerDay(undefined)).toBe(DEFAULT_LIVE_RUNS_PER_DAY);
    expect(parseLiveRunsPerDay("")).toBe(DEFAULT_LIVE_RUNS_PER_DAY);
    expect(parseLiveRunsPerDay("abc")).toBe(DEFAULT_LIVE_RUNS_PER_DAY);
    expect(parseLiveRunsPerDay("-3")).toBe(DEFAULT_LIVE_RUNS_PER_DAY);
    expect(parseLiveRunsPerDay("5x")).toBe(DEFAULT_LIVE_RUNS_PER_DAY);
    expect(parseLiveRunsPerDay("25")).toBe(25);
    expect(parseLiveRunsPerDay("0")).toBe(0);
  });
});

describe("scheduler obeys the same controls as manual runs", () => {
  async function setup() {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const business = saveBusiness(db, user.id, businessInputSchema.parse({
      name: "Riverside Test Dental", websiteUrl: "riverside-test-dental.example", category: "Dentist", city: "Testville", region: "TS", country: "US",
      serviceArea: "Testville", services: ["teeth cleaning"],
    }));
    saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
    setSchedule(db, business.id, "weekly");
    return { db, business };
  }
  const live = () => ["perplexity" as const];

  it("starts a run, logs an event, and does not overlap an active run", async () => {
    const { db, business } = await setup();
    expect(runScheduler(db, { liveAdapterIds: live, extractorConfigured: false })).toBe(1);
    expect(listEvents(db, business.id).some((e) => e.type === "run_started" && e.meta.scheduled === true)).toBe(true);
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect(runScheduler(db, { liveAdapterIds: live, extractorConfigured: false, now: later })).toBe(0);
  });

  it("respects the daily live-run cap", async () => {
    const { db, business } = await setup();
    const skips: string[] = [];
    // Simulate reaching the cap: one completed live run today, cap of 1.
    runScheduler(db, { liveAdapterIds: live, extractorConfigured: false });
    for (const r of listRuns(db, business.id)) setRunStatus(db, r.id, "complete");
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect(runScheduler(db, { liveAdapterIds: live, extractorConfigured: false, now: later, liveRunsPerDay: 1, log: (e, m) => skips.push(`${e}:${String(m.reason)}`) })).toBe(0);
    expect(skips).toContain("scheduler.skip:daily_cap");
  });
});
