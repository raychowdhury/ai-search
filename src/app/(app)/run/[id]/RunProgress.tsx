"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, chipIcons, LinkButton, Notice } from "@/components/ui";

interface Status {
  status: "queued" | "running" | "complete" | "failed";
  dataMode: "live" | "demo";
  checks: Array<{ id: string; questionText: string; platform: string; status: string; errorCode: string | null }>;
  audit: string;
}

const REASONS: Record<string, string> = {
  demo_simulated_outage: "simulated outage (sample data)",
  rate_limited: "the platform was busy",
  provider_unavailable: "the platform was unavailable",
  network_error: "we could not reach the platform",
  refusal: "the platform declined to answer",
  auth_failed: "the API key was rejected",
  empty_answer: "no answer text was returned",
  timeout: "the platform took too long",
  gave_up: "did not complete after retries",
};

export function RunProgress({ runId }: { runId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/status`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as Status;
        if (!active) return;
        setStatus(data);
        setError(null);
        if (data.status === "complete") {
          router.push(`/dashboard?run=${runId}`);
          return;
        }
        if (data.status === "failed") return;
      } catch {
        if (active) setError("We lost contact with the server. Retrying…");
      }
      timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [runId, router]);

  if (!status) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="sk" style={{ width: "60%", height: 16 }} />
        <div className="card gap-3 p-4"><div className="sk" style={{ width: "80%" }} /><div className="sk" style={{ width: "70%" }} /><div className="sk" style={{ width: "75%" }} /></div>
        <span className="sr-only">Loading progress</span>
      </div>
    );
  }
  const done = status.checks.filter((c) => c.status === "success" || c.status === "failed").length;
  const auditText = status.audit === "complete" ? "done" : status.audit === "failed_fetch" ? "could not reach site" : "in progress";
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <p className="m-0 text-[14px]">
        {status.status === "complete" ? "Check complete." : status.status === "failed" ? "This check could not be completed." : `Checking ${done} of ${status.checks.length} questions…`} Website audit: {auditText}.
      </p>
      {status.dataMode === "demo" ? <Notice kind="warning">This is a sample check. Answers are generated from templates, not from an AI platform.</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <ul className="card m-0 list-none gap-0 p-0">
        {status.checks.map((c, i) => (
          <li key={c.id} className={`flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${i ? "rowline" : ""}`}>
            <span className="text-[14px]">{c.questionText}</span>
            <span className="row shrink-0 gap-2 text-[12px]">
              <span className="m2">{c.platform.replace(/\s*\(.*\)\s*$/, "")}</span>
              {c.status === "success" ? <Chip tone="good">Done</Chip> : c.status === "failed" ? <Chip tone="bad">Failed: {REASONS[c.errorCode ?? ""] ?? c.errorCode}</Chip> : c.status === "running" ? <Chip tone="ink" icon={chipIcons.running}>Running</Chip> : <Chip tone="neutral" icon={chipIcons.queued}>Queued</Chip>}
            </span>
          </li>
        ))}
      </ul>
      {status.status === "complete" ? <LinkButton href={`/dashboard?run=${runId}`} className="self-start">See the report</LinkButton> : null}
      {status.status === "failed" ? <LinkButton href="/questions" variant="secondary" className="self-start">Back to questions</LinkButton> : null}
    </div>
  );
}
