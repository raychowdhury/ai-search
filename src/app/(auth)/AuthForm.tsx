"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import type { AuthState } from "@/server/actions/auth";

export function AuthForm({ mode, action, next }: { mode: "login" | "signup"; action: (prev: AuthState, data: FormData) => Promise<AuthState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div className="flex flex-1 flex-col">
      <nav className="row h-14 justify-between border-b border-line px-5 sm:h-16 sm:px-16">
        <Link href="/" className="text-fg text-[16px] font-semibold tracking-tight">Mentioned</Link>
        {mode === "signup" ? <Link href="/login" className="m2 text-[14px]">Sign in</Link> : <Link href="/signup" className="m2 text-[14px]">Create an account</Link>}
      </nav>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-5 py-12">
        <h1 className="mb-1 text-[26px] tracking-[-0.03em]">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
        <p className="m2 mb-6 text-[14px]">{mode === "signup" ? "Free during the trial period. Your first check takes about ten minutes." : "Welcome back."}</p>
        <form action={formAction} noValidate className="card gap-0 p-5">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field label="Email" name="email">
            <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <Field label="Password" name="password" hint={mode === "signup" ? "At least 10 characters." : undefined}>
            <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required className={inputClass} />
          </Field>
          {state.error ? <div className="mb-4"><Notice kind="error">{state.error}</Notice></div> : null}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
        </form>
        <p className="m2 mt-6 text-[13px]">
          {mode === "signup" ? (
            <>Already have an account? <Link href="/login">Sign in</Link></>
          ) : (
            <>New here? <Link href="/signup">Create an account</Link></>
          )}
        </p>
      </main>
    </div>
  );
}
