import Link from "next/link";
import { getDb } from "@/db/client";
import { requireBusiness, loadRunReport } from "@/server/data";
import { latestCompleteRun, latestRun } from "@/lib/collect/runs";
import { PLATFORM_LABELS } from "@/lib/platforms/types";
import { Card, CardTitle, Chip, chipIcons, CompetitorBar, DataModeBadge, LinkButton, MetricSentence, Notice, formatDate } from "@/components/ui";
import { IconChevron, IconLines, IconPeople, IconSearch } from "@/components/icons";
import { StatusChip } from "@/components/report";

function shortLabel(id: keyof typeof PLATFORM_LABELS): string {
  return PLATFORM_LABELS[id].replace(/\s*\(.*\)\s*$/, "").replace("ChatGPT models", "ChatGPT");
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { business } = await requireBusiness();
  const db = getDb();
  const { run: requested } = await searchParams;
  const newest = latestRun(db, business.id);
  const target = requested ?? latestCompleteRun(db, business.id)?.id;

  if (!target || (newest && newest.id === target && (newest.status === "queued" || newest.status === "running"))) {
    const running = newest && (newest.status === "queued" || newest.status === "running") ? newest : null;
    return (
      <div className="flex min-h-[60vh] flex-col justify-center gap-3">
        {running ? (
          <>
            <span className="chip chip-ink self-start">{chipIcons.running}Running</span>
            <h1 className="text-[22px]">A check is running</h1>
            <p className="m2 m-0">Started {formatDate(running.startedAt ?? running.createdAt)}. This usually takes a minute or two.</p>
            <LinkButton href={`/run/${running.id}`} className="mt-2 self-start">See progress</LinkButton>
          </>
        ) : (
          <>
            <h1 className="text-[22px]">No checks yet</h1>
            <p className="m2 m-0">Run your first check to see whether AI assistants mention {business.name}.</p>
            <LinkButton href="/questions" className="mt-2 self-start">Run your first check</LinkButton>
          </>
        )}
      </div>
    );
  }

  const report = loadRunReport(business, target);
  const { run, metrics, recommendations, audit } = report;
  if (run.status !== "complete") {
    return (
      <div className="flex min-h-[60vh] flex-col justify-center gap-3">
        <h1 className="text-[22px]">This check is {run.status === "failed" ? "not complete" : run.status}</h1>
        {run.status === "failed" ? <Notice kind="error">This check could not be completed. Try running it again from Questions.</Notice> : <LinkButton href={`/run/${run.id}`} className="self-start">See progress</LinkButton>}
      </div>
    );
  }

  const n = metrics.successfulChecks;
  const isSample = run.dataMode === "demo";
  const competitors = metrics.competitors.slice(0, 4);
  const platforms = run.platforms.map(shortLabel).join(", ");

  // Per-question rollup across platforms: "Mentioned 2 of 2", "Not mentioned", "1 failed".
  const byQuestion = new Map<string, { text: string; checkId: string; successful: number; mentioned: number; failed: number }>();
  for (const q of metrics.questions) {
    const row = byQuestion.get(q.questionId) ?? { text: q.questionText, checkId: q.checkId, successful: 0, mentioned: 0, failed: 0 };
    if (q.status === "success") row.successful += 1;
    if (q.status === "failed") row.failed += 1;
    if (q.ownerMentioned) row.mentioned += 1;
    byQuestion.set(q.questionId, row);
  }
  const auditCounts = audit?.status === "complete"
    ? { good: audit.findings.filter((f) => f.severity === "good").length, warn: audit.findings.filter((f) => f.severity === "warn").length, missing: audit.findings.filter((f) => f.severity === "missing").length }
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[20px] sm:text-2xl">{business.name}</h1>
        <div className="row flex-wrap gap-x-3.5 gap-y-2 text-[13px]">
          <DataModeBadge mode={run.dataMode} />
          <span className="m2">Checked {formatDate(run.finishedAt)}</span><span className="m3">·</span>
          <span className="m2">{platforms}</span><span className="m3">·</span>
          <span className="m2">questions v{run.questionSetVersion}</span>
          {newest && newest.id !== run.id && (newest.status === "queued" || newest.status === "running") ? <Link href={`/run/${newest.id}`}>A newer check is running</Link> : null}
        </div>
        {isSample ? <Notice kind="warning">These are sample answers generated from templates. They are not real AI answers about your business. Connect a platform in Settings to run a live check.</Notice> : null}
        {run.analysisNote ? <Notice kind="info">{run.analysisNote}</Notice> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card inv={!isSample} sample={isSample} className="gap-2.5">
          <div className="row justify-between"><h2 className="k">Do I appear?</h2>{isSample ? <Chip tone="sample" noIcon>Sample</Chip> : <span className="ico"><IconSearch /></span>}</div>
          <MetricSentence label="Mentioned" numerator={metrics.mentionRate.numerator} denominator={n} big />
          <div className="text-[14px] leading-relaxed">
            <MetricSentence label="Recommended" numerator={metrics.recommendationRate.numerator} denominator={n} />
            <MetricSentence label="Your website cited" numerator={metrics.citationRate.numerator} denominator={n} />
          </div>
          <div className="dt">{n} successful {isSample ? "sample " : ""}answer{n === 1 ? "" : "s"}{metrics.failedChecks ? `, ${metrics.failedChecks} ${isSample ? "simulated failure" : "failed check"}${metrics.failedChecks === 1 ? "" : "s"} not counted` : ""}</div>
          <div className="flex-1" />
          <Link href={`/report/${run.id}/answers`} className="flex min-h-11 items-center lg:min-h-0">See the answers</Link>
        </Card>

        <Card sample={isSample} className="gap-2.5">
          <div className="row justify-between"><h2 className="k">Who else appears?</h2>{isSample ? <Chip tone="sample" noIcon>Sample</Chip> : <span className="ico"><IconPeople /></span>}</div>
          {run.summary?.competitorExtraction === "unavailable" ? (
            <p className="m2 m-0 text-[13px]">We could not identify other businesses for this check because no analysis model was configured.</p>
          ) : competitors.length === 0 ? (
            <p className="m2 m-0 text-[13px]">No other businesses were named in these answers.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {competitors.map((c) => <CompetitorBar key={c.normalizedName} name={c.name} count={c.mentioned} total={n} />)}
              <div className="rowline pt-2"><CompetitorBar name={<>{business.name} <span className="m2">(you)</span></>} count={metrics.mentionRate.numerator} total={n} you /></div>
            </div>
          )}
          <div className="flex-1" />
          <Link href={`/report/${run.id}/competitors`} className="flex min-h-11 items-center lg:min-h-0">Compare competitors</Link>
        </Card>

        <Card sample={isSample} className="gap-2.5">
          <div className="row justify-between"><h2 className="k">What should I do next?</h2>{isSample ? <Chip tone="sample" noIcon>Sample</Chip> : <span className="ico"><IconLines /></span>}</div>
          {recommendations.length === 0 ? (
            <p className="m2 m-0 text-[13px]">No actions could be derived from this check.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[14px]">
              {recommendations.map((r) => (
                <li key={r.id} className="flex gap-2.5">
                  <span className="m3 w-5 shrink-0 pt-[3px] font-mono text-[12px]">{r.rank}</span>
                  <div className="flex flex-col gap-1.5">
                    <Link href={`/actions#action-${r.id}`} className="font-medium text-fg">{r.title}</Link>
                    <div className="row gap-1.5"><span className="chip">effort: {r.effort}</span><StatusChip status={r.status} /></div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="flex-1" />
          <Link href="/actions" className="flex min-h-11 items-center lg:min-h-0">See all actions</Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card className="gap-0">
          <CardTitle>Questions we asked</CardTitle>
          {[...byQuestion.values()].map((q) => (
            <div key={q.checkId} className="rowline flex flex-col gap-1.5 py-2.5 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <Link href={`/report/${run.id}/answers#check-${q.checkId}`} className="text-fg">{q.text}</Link>
              <span className="row shrink-0 gap-1.5">
                {q.mentioned > 0 ? <Chip tone="good">Mentioned {q.mentioned} of {q.successful}</Chip> : q.successful > 0 ? <Chip tone="neutral" icon={chipIcons.minus}>Not mentioned</Chip> : null}
                {q.failed > 0 ? <Chip tone="bad">{q.failed} failed</Chip> : null}
              </span>
            </div>
          ))}
        </Card>
        <Card className="gap-2.5">
          <CardTitle>Website check</CardTitle>
          {audit ? (
            auditCounts ? (
              <>
                <div className="text-[18px] font-semibold leading-snug tracking-tight" style={{ textWrap: "pretty" }}>{auditCounts.good} thing{auditCounts.good === 1 ? "" : "s"} look{auditCounts.good === 1 ? "s" : ""} good, {auditCounts.warn} need attention, {auditCounts.missing} missing</div>
                <div className="row flex-wrap gap-1.5"><Chip tone="good">{auditCounts.good} good</Chip><Chip tone="warn">{auditCounts.warn} need attention</Chip><Chip tone="bad">{auditCounts.missing} missing</Chip></div>
                <div className="dt">Read from {business.websiteDomain} on {formatDate(audit.finishedAt)}</div>
              </>
            ) : (
              <p className="m-0 text-[14px]">We could not read your website: {audit.errorMessage ?? "unknown reason"}.</p>
            )
          ) : (
            <p className="m2 m-0 text-[13px]">The website audit is still running or has not been done yet.</p>
          )}
          <div className="flex-1" />
          <Link href={`/report/${run.id}/website`} className="flex min-h-11 items-center lg:min-h-0">See the website audit</Link>
        </Card>
      </div>

      <details className="text-[13px]">
        <summary className="m2 row min-h-11 cursor-pointer gap-2 py-1.5"><IconChevron width={12} height={12} />How to read this</summary>
        <ul className="m2 mt-1 list-disc pl-5 leading-[1.7]">
          <li>&ldquo;3 of 13&rdquo; means your business appeared in 3 of the 13 answers we collected.</li>
          <li>Mentioned means your name appears. Recommended means you were presented as an option. Cited means your website was among the sources.</li>
          <li>Answers were collected through each platform&apos;s API, which is related to but not identical to the consumer app.</li>
          <li>Results vary with wording, location, and time. Only checks with the same questions, platforms, and location are compared.</li>
          <li>Actions are improvement opportunities, not guarantees.</li>
        </ul>
      </details>
      <div className="dt">To run this check again with the same questions, go to <Link href="/questions">Questions</Link>.</div>
    </div>
  );
}
