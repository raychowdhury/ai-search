"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { authenticate, createUser, findUserByEmail } from "@/lib/auth/users";
import { createSession, deleteSession, SESSION_COOKIE } from "@/lib/auth/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rateLimit";
import { clearSessionCookie, setSessionCookie } from "@/server/auth";
import { cookies } from "next/headers";

export interface AuthState {
  error?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(200),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Passwords need at least ${PASSWORD_MIN_LENGTH} characters`).max(200),
});

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(value: FormDataEntryValue | null): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  if (!rateLimit(`signup:${await clientKey()}`, 10, 60 * 60 * 1000)) return { error: "Too many attempts. Please try again later." };
  const db = getDb();
  if (findUserByEmail(db, parsed.data.email)) return { error: "An account with that email already exists. Try signing in." };
  const user = await createUser(db, parsed.data.email, parsed.data.password);
  const { token, expiresAt } = createSession(db, user.id);
  await setSessionCookie(token, expiresAt);
  redirect("/onboarding");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email or password is incorrect" };
  const key = await clientKey();
  if (!rateLimit(`login:${key}`, 20, 15 * 60 * 1000) || !rateLimit(`login:${parsed.data.email}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const db = getDb();
  const user = await authenticate(db, parsed.data.email, parsed.data.password);
  if (!user) return { error: "Email or password is incorrect" };
  const { token, expiresAt } = createSession(db, user.id);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  deleteSession(getDb(), store.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  redirect("/login");
}
