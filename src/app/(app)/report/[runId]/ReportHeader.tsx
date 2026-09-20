import Link from "next/link";
import type { Run } from "@/lib/collect/runs";
import { PLATFORM_LABELS } from "@/lib/platforms/types";
import { DataModeBadge, Notice, formatDate } from "@/components/ui";

export function ReportHeader({ run, current }: { run: Run; current: "answers" | "competitors" | "website" }) {
  const tabs = [
    { key: "answers", label: "Answers", href: `/report/${run.id}/answers` },
    { key: "competitors", label: "Competitors", href: `/report/${run.id}/competitors` },
    { key: "website", label: "Website", href: `/report/${run.id}/website` },
  ] as const;
  const platforms = run.platforms.map((p) => PLATFORM_LABELS[p].replace(/\s*\(.*\)\s*$/, "")).join(", ");
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="row flex-wrap gap-x-3.5 gap-y-2 text-[13px]">
        <Link href={`/dashboard?run=${run.id}`}>Dashboard</Link>
        <span className="m3">/</span>
        <DataModeBadge mode={run.dataMode} />
        <span className="m2">Checked {formatDate(run.finishedAt)}</span><span className="m3">·</span>
        <span className="m2">{platforms}</span><span className="m3">·</span>
        <span className="m2">questions v{run.questionSetVersion}</span>
      </div>
      <nav aria-label="Report sections" className="tabs">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>
      {run.dataMode === "demo" ? <Notice kind="warning">Sample data: answers generated from templates, not from an AI platform.</Notice> : null}
    </div>
  );
}
