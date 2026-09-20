/**
 * Seeds a demo account and runs a sample check through the worker.
 * Usage: DATABASE_PATH=./data/app.db pnpm dlx tsx scripts/seed-demo.mts
 * Prints a session cookie value you can use with curl.
 */
import { openDatabase } from "@/db/client";
import { createUser, findUserByEmail } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/session";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness, getBusinessForUser } from "@/lib/business/repo";
import { suggestQuestions } from "@/lib/questions/suggest";
import { saveQuestionSet, newQuestion, getCurrentQuestionSet } from "@/lib/questions/repo";
import { createRun, getRun } from "@/lib/collect/runs";
import { drain } from "@/lib/jobs/worker";
import { buildFingerprint } from "@/lib/collect/fingerprint";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");
const db = openDatabase(dbPath);
const email = process.env.SEED_EMAIL ?? "demo-owner@example.com";
const password = process.env.SEED_PASSWORD ?? "demo-password-123";

const user = findUserByEmail(db, email) ?? (await createUser(db, email, password));
const business =
  getBusinessForUser(db, user.id) ??
  saveBusiness(
    db,
    user.id,
    businessInputSchema.parse({
      name: "Example Family Dental",
      aliases: ["Example Dental"],
      websiteUrl: process.env.SEED_WEBSITE ?? "https://example.com",
      category: "Dentist",
      city: "Springfield",
      region: "Illinois",
      country: "US",
      timezone: "America/Chicago",
      serviceArea: "Springfield and towns within 20 miles",
      services: ["teeth cleaning", "emergency dental care", "invisible braces"],
    }),
  );
const qs = getCurrentQuestionSet(db, business.id) ?? saveQuestionSet(db, business.id, suggestQuestions(business).map((t) => newQuestion(t, "suggested")));
const run = createRun(db, business, qs, ["demo"], "demo", { fingerprint: buildFingerprint(["demo"], "demo", false) });
const jobs = process.env.SEED_NO_DRAIN ? 0 : await drain({ db, log: (m) => console.log(m), extractorEnabled: false });
const done = getRun(db, run.id)!;
const { token } = createSession(db, user.id);
console.log(JSON.stringify({ email, password, businessId: business.id, runId: run.id, runStatus: done.status, summary: done.summary, jobs, sessionCookie: token }, null, 2));
