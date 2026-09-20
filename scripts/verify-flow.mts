/**
 * Exercises the correction workflow against a database copy: confirm facts, run a
 * sample check, mark the top audit-based action done, verify it (real fetch of the
 * site), and print the resulting states. Usage: DATABASE_PATH=<copy> pnpm dlx tsx scripts/verify-flow.mts
 */
import { openDatabase } from "@/db/client";
import { findUserByEmail, createUser } from "@/lib/auth/users";
import { businessInputSchema } from "@/lib/business/schema";
import { saveBusiness, getBusinessForUser } from "@/lib/business/repo";
import { suggestQuestionsDetailed } from "@/lib/questions/suggest";
import { saveQuestionSet, suggestedQuestionSet, getCurrentQuestionSet } from "@/lib/questions/repo";
import { createRun, getRun } from "@/lib/collect/runs";
import { buildFingerprint } from "@/lib/collect/fingerprint";
import { drain } from "@/lib/jobs/worker";
import { enqueue } from "@/lib/jobs/queue";
import { recommendationsForRun, setRecommendationStatus, setVerification } from "@/lib/recommend/store";
import { listEvents } from "@/lib/events";

const db = openDatabase(process.env.DATABASE_PATH!);
const email = "demo-owner@example.com";
const user = findUserByEmail(db, email) ?? (await createUser(db, email, "demo-password-123"));
const existing = getBusinessForUser(db, user.id);
const business = saveBusiness(db, user.id, businessInputSchema.parse({
  name: existing?.name ?? "Example Family Dental", aliases: existing?.aliases ?? [], websiteUrl: existing?.websiteUrl ?? "https://example.com", category: existing?.category ?? "Dentist",
  city: existing?.city ?? "Springfield", region: existing?.region ?? "Illinois", country: existing?.country ?? "US", timezone: existing?.timezone ?? "",
  serviceArea: existing?.serviceArea ?? "Springfield and towns within 20 miles", services: existing?.services ?? ["teeth cleaning"],
  phone: "(217) 555-0100", hours: "Mon–Fri 8am–5pm, Sat 9am–1pm", businessType: "storefront", bookingUrl: "", priorityServices: [existing?.services?.[0] ?? "teeth cleaning"],
}));
console.log("facts confirmed at:", business.factsConfirmedAt);
const qs = getCurrentQuestionSet(db, business.id) ?? saveQuestionSet(db, business.id, suggestedQuestionSet(suggestQuestionsDetailed(business)));
const run = createRun(db, business, qs, ["demo"], "demo", { fingerprint: buildFingerprint(["demo"], "demo", false) });
await drain({ db, log: () => {}, extractorEnabled: false });
const done = getRun(db, run.id)!;
console.log("run:", done.status, "summary:", done.summary, "note:", done.analysisNote);
const recs = recommendationsForRun(db, run.id);
for (const r of recs) console.log(`#${r.rank} ${r.ruleId} scope=${r.scope} verify=[${r.verifyRules.join(",")}] needs=[${r.needsConfirmation.join(",")}] status=${r.status}/${r.verificationStatus}`);
const target = recs.find((r) => r.verifyRules.length > 0) ?? recs[0];
setRecommendationStatus(db, target.id, business.id, "done");
setVerification(db, target.id, "queued", null);
enqueue(db, "verify_action", { recommendationId: target.id });
await drain({ db, log: (m) => console.log(m), extractorEnabled: false });
const after = recommendationsForRun(db, run.id).find((r) => r.id === target.id)!;
console.log("verified:", after.ruleId, after.verificationStatus, "-", after.verificationNote);
console.log("events:", listEvents(db, business.id).map((e) => e.type).join(", "));
