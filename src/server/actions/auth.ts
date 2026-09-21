"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { authenticate, createUser, findUserByEmail, getUserById, setPassword, markEmailVerified } from "@/lib/auth/users";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { getMailer, passwordResetMail, verifyEmailMail } from "@/lib/email/mailer";
import { logJson } from "@/lib/observability";
import { createSession, deleteSession, SESSION_COOKIE } from "@/lib/auth/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rateLimit";
import { clearSessionCookie, setSessionCookie } from "@/server/auth";
import { cookies } from "next/headers";

export interface AuthState {
  error?: string;
  ok?: boolean;
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
  const verify = issueToken(db, user.id, "verify");
  const sent = await getMailer().send(verifyEmailMail(user.email, verify.token));
  if (!sent.ok) logJson("warn", "email.verify_send_failed", { userId: user.id, error: sent.error });
  const { token, expiresAt } = createSession(db, user.id);
  await setSessionCookie(token, expiresAt);
  redirect("/onboarding");
}

const emailOnly = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/** Always responds the same way so the form does not reveal whether an email exists. */
export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Please enter a valid email address" };
  if (!rateLimit(`forgot:${await clientKey()}`, 5, 15 * 60 * 1000) || !rateLimit(`forgot:${parsed.data.email}`, 3, 60 * 60 * 1000)) {
    return { error: "Too many requests. Please wait a while and try again." };
  }
  const db = getDb();
  const user = findUserByEmail(db, parsed.data.email);
  if (user) {
    const { token } = issueToken(db, user.id, "reset");
    const sent = await getMailer().send(passwordResetMail(user.email, token));
    if (!sent.ok) logJson("warn", "email.reset_send_failed", { userId: user.id, error: sent.error });
  }
  return { ok: true };
}

const resetSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Passwords need at least ${PASSWORD_MIN_LENGTH} characters`).max(200),
});

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "This reset link is not valid" };
  if (!rateLimit(`reset:${await clientKey()}`, 10, 15 * 60 * 1000)) return { error: "Too many attempts. Please wait and try again." };
  const db = getDb();
  const userId = consumeToken(db, parsed.data.token, "reset");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };
  await setPassword(db, userId, parsed.data.password);
  const user = getUserById(db, userId);
  if (user && !user.email_verified_at) markEmailVerified(db, userId); // proving control of the inbox verifies it
  const { token, expiresAt } = createSession(db, userId);
  await setSessionCookie(token, expiresAt);
  redirect("/dashboard?reset=1");
}

export async function resendVerificationAction(): Promise<void> {
  const store = await cookies();
  const db = getDb();
  const { findUserBySessionToken } = await import("@/lib/auth/session");
  const user = findUserBySessionToken(db, store.get(SESSION_COOKIE)?.value);
  if (!user) redirect("/login");
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60 * 1000)) redirect("/settings?error=verify_limit");
  const { token } = issueToken(db, user.id, "verify");
  const sent = await getMailer().send(verifyEmailMail(user.email, token));
  redirect(sent.ok ? "/settings?sent=verify" : "/settings?error=verify_send");
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
