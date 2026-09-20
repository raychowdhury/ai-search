import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { findUserBySessionToken, SESSION_COOKIE, type SessionUser } from "@/lib/auth/session";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return findUserBySessionToken(getDb(), store.get(SESSION_COOKIE)?.value);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
