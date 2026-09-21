"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth";
import { getBusinessForUser } from "@/lib/business/repo";
import { getCurrentQuestionSet, saveQuestionSet, questionListSchema } from "@/lib/questions/repo";
import { createRun, countActiveRuns, countLiveRunsLastDay } from "@/lib/collect/runs";
import { buildFingerprint } from "@/lib/collect/fingerprint";
import { LIVE_RUNS_PER_DAY } from "@/lib/collect/limits";
import { configuredLiveAdapters } from "@/lib/platforms/registry";
import { isExtractorConfigured } from "@/lib/analyze/extractorSelect";
import { getRecommendation, setRecommendationStatus, setVerification } from "@/lib/recommend/store";
import { enqueue } from "@/lib/jobs/queue";
import { logEvent } from "@/lib/events";
import type { FormState } from "./business";

const intentSchema = z.enum(["save", "run_live", "run_demo"]);

/** Saves the question list (if provided) and optionally starts a run. */
export async function questionsAndRunAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  const intent = intentSchema.safeParse(formData.get("intent"));
  if (!intent.success) return { error: "Unknown action" };

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw === "string" && payloadRaw) {
    let payload: unknown;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return { error: "Could not read the questions. Please refresh and try again." };
    }
    const parsed = z.object({ questions: questionListSchema }).safeParse(payload);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your questions" };
    saveQuestionSet(db, business.id, parsed.data.questions);
  }
  if (intent.data === "save") return { ok: true };

  const questionSet = getCurrentQuestionSet(db, business.id);
  if (!questionSet) return { error: "Add at least one question first." };
  if (countActiveRuns(db, business.id) >= 3) return { error: "A check is already running. Please wait for it to finish." };

  const live = intent.data === "run_live";
  const platforms = live ? configuredLiveAdapters().map((a) => a.id) : (["demo"] as const);
  if (platforms.length === 0) return { error: "No AI platforms are connected. Add an API key to run a live check, or run a sample check." };
  if (live && countLiveRunsLastDay(db, business.id) >= LIVE_RUNS_PER_DAY) {
    return { error: `You have reached the limit of ${LIVE_RUNS_PER_DAY} live checks per day. Try again tomorrow.` };
  }
  const dataMode = live ? "live" : "demo";
  const run = createRun(db, business, questionSet, [...platforms], dataMode, {
    fingerprint: buildFingerprint([...platforms], dataMode, isExtractorConfigured()),
  });
  logEvent(db, business.id, "run_started", { runId: run.id, dataMode, platforms });
  redirect(`/run/${run.id}`);
}

export async function setActionStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  const parsed = z
    .object({ id: z.string().min(1), status: z.enum(["pending", "in_progress", "done", "skipped"]), back: z.string().optional() })
    .safeParse({ id: formData.get("id"), status: formData.get("status"), back: formData.get("back") ?? undefined });
  if (parsed.success) {
    const rec = getRecommendation(db, parsed.data.id);
    if (rec && rec.businessId === business.id) {
      const changed = setRecommendationStatus(db, rec.id, business.id, parsed.data.status);
      if (changed) {
        if (parsed.data.status === "in_progress") logEvent(db, business.id, "action_started", { recommendationId: rec.id, ruleId: rec.ruleId });
        if (parsed.data.status === "done") {
          // Owner intent is recorded; success is only claimed after a fresh check.
          logEvent(db, business.id, "action_done_reported", { recommendationId: rec.id, ruleId: rec.ruleId });
          setVerification(db, rec.id, "queued", "Checking your site again to see whether this is fixed.");
          enqueue(db, "verify_action", { recommendationId: rec.id });
        }
      }
    }
  }
  const back = parsed.success && parsed.data.back?.startsWith("/") ? parsed.data.back : "/actions";
  redirect(back);
}

/** Re-checks a done action on request (for example after the site was updated again). */
export async function recheckActionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  const id = String(formData.get("id") ?? "");
  const rec = getRecommendation(db, id);
  if (rec && rec.businessId === business.id) {
    setVerification(db, rec.id, "queued", "Checking your site again.");
    enqueue(db, "verify_action", { recommendationId: rec.id });
  }
  redirect("/actions");
}
