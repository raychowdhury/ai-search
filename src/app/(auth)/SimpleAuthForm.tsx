"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import type { AuthState } from "@/server/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

interface FieldSpec {
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  hint?: string;
}

export function SimpleAuthForm({ title, intro, action, submitLabel, successMessage, fields, hidden = {} }: {
  title: string;
  intro: string;
  action: (prev: AuthState, data: FormData) => Promise<AuthState>;
  submitLabel: string;
  successMessage?: string;
  fields: FieldSpec[];
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div className="flex flex-1 flex-col">
      <nav className="row h-14 justify-between border-b border-line px-5 sm:h-16 sm:px-16">
        <Link href="/" className="text-fg text-[16px] font-semibold tracking-tight">Mentioned</Link>
        <span className="row gap-4"><ThemeToggle /><Link href="/login" className="m2 text-[14px]">Sign in</Link></span>
      </nav>
      <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-5 py-12">
        <h1 className="mb-1 text-[26px] tracking-[-0.03em]">{title}</h1>
        <p className="m2 mb-6 text-[14px]">{intro}</p>
        {state.ok && successMessage ? (
          <Notice kind="success">{successMessage}</Notice>
        ) : (
          <form action={formAction} noValidate className="card gap-0 p-5">
            {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {fields.map((f) => (
              <Field key={f.name} label={f.label} name={f.name} hint={f.hint}>
                <input id={f.name} name={f.name} type={f.type} autoComplete={f.autoComplete} required className={inputClass} />
              </Field>
            ))}
            {state.error ? <div className="mb-4"><Notice kind="error">{state.error}</Notice></div> : null}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Please wait…" : submitLabel}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
