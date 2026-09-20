"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth";
import { getBusinessForUser } from "@/lib/business/repo";
import { getCurrentQuestionSet, saveQuestionSet, questionListSchema } from "@/lib/questions/repo";
import { createRun, countActiveRuns } from "@/lib/collect/runs";
import { configuredLiveAdapters } from "@/lib/platforms/registry";
import { setRecommendationStatus } from "@/lib/recommend/store";
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

  const platforms = intent.data === "run_live" ? configuredLiveAdapters().map((a) => a.id) : (["demo"] as const);
  if (platforms.length === 0) return { error: "No AI platforms are connected. Add an API key to run a live check, or run a sample check." };
  const run = createRun(db, business, questionSet, [...platforms], intent.data === "run_live" ? "live" : "demo");
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
  if (parsed.success) setRecommendationStatus(db, parsed.data.id, business.id, parsed.data.status);
  const back = parsed.success && parsed.data.back?.startsWith("/") ? parsed.data.back : "/actions";
  redirect(back);
}
