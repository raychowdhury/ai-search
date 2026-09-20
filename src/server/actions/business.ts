"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { requireUser } from "@/server/auth";
import { businessInputSchema, splitList } from "@/lib/business/schema";
import { saveBusiness, getBusinessForUser, setSchedule, deleteBusiness } from "@/lib/business/repo";
import { getCurrentQuestionSet, saveQuestionSet, newQuestion, questionListSchema } from "@/lib/questions/repo";
import { suggestQuestions } from "@/lib/questions/suggest";
import { deleteUser } from "@/lib/auth/users";
import { clearSessionCookie } from "@/server/auth";

export interface FormState {
  errors?: Record<string, string>;
  error?: string;
  ok?: boolean;
}

export async function saveBusinessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = {
    name: formData.get("name") ?? "",
    aliases: splitList(String(formData.get("aliases") ?? "")),
    websiteUrl: formData.get("websiteUrl") ?? "",
    category: formData.get("category") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    country: formData.get("country") ?? "",
    timezone: String(formData.get("timezone") ?? ""),
    serviceArea: formData.get("serviceArea") ?? "",
    services: splitList(String(formData.get("services") ?? "")),
  };
  const parsed = businessInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  const db = getDb();
  const hadBusiness = Boolean(getBusinessForUser(db, user.id));
  const business = saveBusiness(db, user.id, parsed.data);
  if (!getCurrentQuestionSet(db, business.id)) {
    saveQuestionSet(db, business.id, suggestQuestions(business).map((t) => newQuestion(t, "suggested")));
  }
  redirect(hadBusiness ? "/settings?saved=1" : "/questions");
}

const questionsPayload = z.object({ questions: questionListSchema });

export async function saveQuestionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Could not read the questions. Please refresh and try again." };
  }
  const parsed = questionsPayload.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your questions" };
  saveQuestionSet(db, business.id, parsed.data.questions);
  return { ok: true };
}

export async function regenerateQuestionsAction(): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  saveQuestionSet(db, business.id, suggestQuestions(business).map((t) => newQuestion(t, "suggested")));
  redirect("/questions");
}

export async function setScheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (!business) redirect("/onboarding");
  const schedule = z.enum(["off", "weekly", "monthly"]).safeParse(formData.get("schedule"));
  if (schedule.success) setSchedule(db, business.id, schedule.data);
  redirect("/settings?saved=1");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (String(formData.get("confirm") ?? "") !== "DELETE") redirect("/settings?error=confirm");
  const db = getDb();
  const business = getBusinessForUser(db, user.id);
  if (business) deleteBusiness(db, business.id);
  deleteUser(db, user.id);
  await clearSessionCookie();
  redirect("/");
}
