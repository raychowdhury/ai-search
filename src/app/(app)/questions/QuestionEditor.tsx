"use client";

import { useActionState, useState } from "react";
import { Button, Chip, Notice, inputClass } from "@/components/ui";
import { IconArrowDown, IconArrowUp, IconX } from "@/components/icons";
import type { FormState } from "@/server/actions/business";
import type { Question } from "@/lib/questions/suggest";

interface Props {
  initial: Question[];
  version: number;
  liveAvailable: boolean;
  livePlatforms: string[];
  costEstimate: string | null;
  action: (prev: FormState, data: FormData) => Promise<FormState>;
}

function tempId(): string {
  return `q${Math.random().toString(36).slice(2, 10)}`;
}

export function QuestionEditor({ initial, version, liveAvailable, livePlatforms, costEstimate, action }: Props) {
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [confirmLive, setConfirmLive] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  const update = (id: string, text: string) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, text, source: q.source === "suggested" && text !== initial.find((i) => i.id === id)?.text ? "owner" : q.source } : q)));
  const remove = (id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id));
  const add = () => setQuestions((qs) => [...qs, { id: tempId(), text: "", source: "owner" }]);
  const move = (index: number, delta: number) =>
    setQuestions((qs) => {
      const next = [...qs];
      const j = index + delta;
      if (j < 0 || j >= next.length) return qs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const cleaned = questions.map((q) => ({ ...q, text: q.text.trim() })).filter((q) => q.text);
  const payload = JSON.stringify({ questions: cleaned });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />
      <p className="m2 m-0 text-[13px]">
        Question set version {version}. These are the kinds of things customers ask an AI assistant. Keep the ones that match what you want to be known for. Changing questions creates a new version, and only checks with the same version can be compared.
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {questions.map((q, i) => (
          <li key={q.id} className="card flex-row items-start gap-2 p-2">
            <span className="m3 mt-3 w-6 shrink-0 text-right font-mono text-[12px]">{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input aria-label={`Question ${i + 1}`} value={q.text} onChange={(e) => update(q.id, e.target.value)} className={inputClass} maxLength={200} />
              {q.source === "owner" ? <span><Chip tone="ink" noIcon>yours</Chip></span> : null}
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="btn btn-ghost min-w-11 px-0"><IconArrowUp /></button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="btn btn-ghost min-w-11 px-0"><IconArrowDown /></button>
              <button type="button" onClick={() => remove(q.id)} aria-label="Remove question" className="btn btn-ghost min-w-11 px-0" style={{ color: "var(--bad)" }}><IconX /></button>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button type="button" variant="secondary" onClick={add} disabled={questions.length >= 20}>Add a question</Button>
      </div>
      {state.error ? <Notice kind="error">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="success">Questions saved.</Notice> : null}
      {!liveAvailable ? (
        <Notice kind="warning">No AI platforms are connected yet. You can run a sample check to see how the report works. Sample answers are generated from templates and are not real AI answers about your business.</Notice>
      ) : confirmLive ? (
        <div className="card gap-3 p-4">
          <p className="m-0 text-[14px]">This live check will ask {cleaned.length} question{cleaned.length === 1 ? "" : "s"} on {livePlatforms.join(" and ")}{costEstimate ? ` and use about ${costEstimate} in API usage` : ""}. Answers and sources are stored so you can read them later.</p>
          <div className="row flex-wrap gap-2.5">
            <Button type="submit" name="intent" value="run_live" disabled={pending}>{pending ? "Starting…" : "Confirm and run"}</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmLive(false)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Notice kind="info">Live check will ask: {livePlatforms.join(", ")}.{costEstimate ? ` About ${costEstimate} in API usage per check.` : ""}</Notice>
      )}
      {!confirmLive ? (
        <div className="row flex-wrap gap-2.5">
          <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>Save questions</Button>
          {liveAvailable ? (
            <Button type="button" onClick={() => setConfirmLive(true)} disabled={pending || cleaned.length === 0}>Run live check{costEstimate ? <span className="m3 font-normal">· about {costEstimate}</span> : null}</Button>
          ) : null}
          <Button type="submit" name="intent" value="run_demo" variant={liveAvailable ? "secondary" : "primary"} disabled={pending}>{pending ? "Starting…" : "Run sample check"}</Button>
        </div>
      ) : null}
    </form>
  );
}
