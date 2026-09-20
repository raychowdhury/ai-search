import { describe, it, expect } from "vitest";
import { openDatabase } from "@/db/client";
import { businessInputSchema, splitList } from "@/lib/business/schema";
import { saveBusiness, getBusinessForUser } from "@/lib/business/repo";
import { suggestQuestions } from "@/lib/questions/suggest";
import { saveQuestionSet, getCurrentQuestionSet, newQuestion } from "@/lib/questions/repo";
import { createUser } from "@/lib/auth/users";

const valid = {
  name: "Riverside Test Dental",
  aliases: [],
  websiteUrl: "riverside-test-dental.example",
  category: "Dentist",
  city: "Testville",
  region: "Test State",
  country: "us",
  serviceArea: "Testville and nearby towns",
  services: ["teeth cleaning", "emergency dental care"],
};

describe("business schema", () => {
  it("accepts valid input and normalizes country", () => {
    const r = businessInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.country).toBe("US");
  });
  it("rejects private website addresses and bad countries", () => {
    expect(businessInputSchema.safeParse({ ...valid, websiteUrl: "http://192.168.0.1" }).success).toBe(false);
    expect(businessInputSchema.safeParse({ ...valid, country: "XX" }).success).toBe(false);
    expect(businessInputSchema.safeParse({ ...valid, services: [] }).success).toBe(false);
  });
  it("splits lists", () => {
    expect(splitList("a, b,\n a ,c")).toEqual(["a", "b", "c"]);
  });
});

describe("business repo and questions", () => {
  it("saves, upserts, suggests, and versions question sets", async () => {
    const db = openDatabase(":memory:");
    const user = await createUser(db, "o@example.com", "long-enough-pw");
    const input = businessInputSchema.parse(valid);
    const b = saveBusiness(db, user.id, input);
    expect(b.websiteDomain).toBe("riverside-test-dental.example");
    const b2 = saveBusiness(db, user.id, { ...input, name: "Renamed" });
    expect(b2.id).toBe(b.id);
    expect(getBusinessForUser(db, user.id)?.name).toBe("Renamed");

    const suggested = suggestQuestions(input);
    expect(suggested.length).toBeGreaterThanOrEqual(8);
    expect(new Set(suggested).size).toBe(suggested.length);
    expect(suggested.some((q) => q.includes("Testville"))).toBe(true);

    const qs1 = saveQuestionSet(db, b.id, suggested.map((t) => newQuestion(t, "suggested")));
    expect(qs1.version).toBe(1);
    expect(saveQuestionSet(db, b.id, qs1.questions).id).toBe(qs1.id);
    const qs2 = saveQuestionSet(db, b.id, [...qs1.questions, newQuestion("Who fixes chipped teeth fast in Testville?", "owner")]);
    expect(qs2.version).toBe(2);
    expect(getCurrentQuestionSet(db, b.id)?.id).toBe(qs2.id);
  });
  it("suggests at least 8 questions with a single service", () => {
    expect(suggestQuestions({ ...valid, services: ["x"] }).length).toBeGreaterThanOrEqual(8);
  });
});
