import Link from "next/link";
import { getDb } from "@/db/client";
import { requireBusiness, loadRunReport } from "@/server/data";
import { listRuns, type Run } from "@/lib/collect/runs";
import type { Business } from "@/lib/business/schema";
import { comparability, compareRuns } from "@/lib/history/compare";
import { PLATFORM_LABELS } from "@/lib/platforms/types";
import { PageTitle, EmptyState, LinkButton, DataModeBadge, Notice, Chip, chipIcons, formatDate } from "@/components/ui";

const short = (p: keyof typeof PLATFORM_LABELS) => PLATFORM_LABELS[p].replace(/\s*\(.*\)\s*$/, "").replace("ChatGPT models", "ChatGPT");

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { business } = await requireBusiness();
  const db = getDb();
  const runs = listRuns(db, business.id);
  const { a, b } = await searchParams;
  const runA = a ? runs.find((r) => r.id === a) : undefined;
  const runB = b ? runs.find((r) => r.id === b) : undefined;

  return (
    <>
      <PageTitle sub="Every check, newest first. Pick two comparable checks to see what changed.">History</PageTitle>
      {runs.length === 0 ? (
        <EmptyState title="Your checks will appear here." action={<LinkButton href="/questions">Run a check</LinkButton>} />
      ) : (
        <form method="get" className="flex flex-col gap-3">
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto p-0 sm:block">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="k text-left"><th className="px-3 py-2.5 font-medium">Compare</th><th className="px-3 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 font-medium">Data</th><th className="px-3 py-2.5 font-medium">Platforms</th><th className="px-3 py-2.5 font-medium">Questions</th><th className="px-3 py-2.5 font-medium">Checks</th><th className="px-3 py-2.5 font-medium">Mentioned</th><th className="px-3 py-2.5"></th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="rowline">
                    <td className="px-3 py-2.5 whitespace-nowrap"><label className="mr-3 text-[12px]"><input type="radio" name="a" value={r.id} defaultChecked={a === r.id} /> A</label><label className="text-[12px]"><input type="radio" name="b" value={r.id} defaultChecked={b === r.id} /> B</label></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(r.finishedAt ?? r.createdAt)}</td>
                    <td className="px-3 py-2.5"><DataModeBadge mode={r.dataMode} /></td>
                    <td className="m2 px-3 py-2.5">{r.platforms.map(short).join(", ")}</td>
                    <td className="m2 px-3 py-2.5">v{r.questionSetVersion}</td>
                    <td className="m2 px-3 py-2.5 whitespace-nowrap">{r.status === "complete" && r.summary ? `${r.summary.successfulChecks} ok / ${r.summary.failedChecks} failed` : <Chip tone={r.status === "failed" ? "bad" : "ink"} icon={r.status === "running" ? chipIcons.running : undefined}>{r.status}</Chip>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{r.status === "complete" && r.summary ? `${r.summary.ownerMentioned} of ${r.summary.successfulChecks}` : "—"}</td>
                    <td className="px-3 py-2.5">{r.status === "complete" ? <Link href={`/dashboard?run=${r.id}`}>view</Link> : <Link href={`/run/${r.id}`}>progress</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phone cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {runs.map((r) => (
              <div key={r.id} className="card gap-2 p-3 text-[13px]">
                <div className="row justify-between"><span className="font-medium">{formatDate(r.finishedAt ?? r.createdAt)}</span><DataModeBadge mode={r.dataMode} /></div>
                <div className="m2">{r.platforms.map(short).join(", ")} · v{r.questionSetVersion}</div>
                <div>{r.status === "complete" && r.summary ? `Mentioned ${r.summary.ownerMentioned} of ${r.summary.successfulChecks} · ${r.summary.failedChecks} failed` : <Chip tone="ink">{r.status}</Chip>}</div>
                <div className="row justify-between">
                  <span className="row gap-3"><label><input type="radio" name="a" value={r.id} defaultChecked={a === r.id} /> A</label><label><input type="radio" name="b" value={r.id} defaultChecked={b === r.id} /> B</label></span>
                  {r.status === "complete" ? <Link href={`/dashboard?run=${r.id}`}>view</Link> : <Link href={`/run/${r.id}`}>progress</Link>}
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="btn self-start">Compare A and B</button>
        </form>
      )}

      {runA && runB && runA.id !== runB.id ? <Comparison business={business} a={runA} b={runB} /> : null}
    </>
  );
}

function Comparison({ business, a, b }: { business: Business; a: Run; b: Run }) {
  const [earlier, later] = new Date(a.createdAt) <= new Date(b.createdAt) ? [a, b] : [b, a];
  const result = comparability(earlier, later);
  const ra = loadRunReport(business, earlier.id);
  const rb = loadRunReport(business, later.id);
  return (
    <section className="card mt-6 gap-4 p-4 sm:p-5">
      <h2 className="k">Comparison</h2>
      <p className="dt m-0">Earlier: {formatDate(earlier.finishedAt ?? earlier.createdAt)} · Later: {formatDate(later.finishedAt ?? later.createdAt)}</p>
      {!result.comparable ? (
        <Notice kind="warning">These checks are not directly comparable: {result.differences.join(", ")}. Both summaries are shown, but differences may come from the setup rather than from a change in the answers.</Notice>
      ) : result.legacy ? (
        <Notice kind="info">One of these checks predates measurement records (model and analysis settings), so a settings change between them cannot be ruled out.</Notice>
      ) : null}
      <div className="grid gap-3 text-[14px] sm:grid-cols-2">
        {[ra, rb].map((r, i) => (
          <div key={r.run.id} className="rounded-md border border-line p-3">
            <p className="k m-0 mb-2">{i === 0 ? "Earlier" : "Later"}</p>
            <p className="m-0">Mentioned in {r.metrics.mentionRate.numerator} of {r.metrics.mentionRate.denominator}</p>
            <p className="m-0">Recommended in {r.metrics.recommendationRate.numerator} of {r.metrics.recommendationRate.denominator}</p>
            <p className="m-0">Website cited in {r.metrics.citationRate.numerator} of {r.metrics.citationRate.denominator}</p>
            <p className="dt m-0 mt-1">{r.metrics.failedChecks} failed checks not counted</p>
          </div>
        ))}
      </div>
      {result.comparable ? (
        <ul className="m-0 flex list-none flex-col p-0 text-[14px]">
          {compareRuns(ra.metrics, rb.metrics).map((c, i) => (
            <li key={`${c.questionId}-${c.platform}`} className={`flex items-start justify-between gap-2 py-2.5 ${i ? "rowline" : ""}`}>
              <span>{c.questionText}</span>
              <span className="shrink-0">
                {c.change === "gained" ? <Chip tone="good">now mentioned</Chip> : c.change === "lost" ? <Chip tone="warn">no longer mentioned</Chip> : c.change === "same" ? <Chip tone="neutral" icon={c.after?.ownerMentioned ? chipIcons.check : chipIcons.minus}>{c.after?.ownerMentioned ? "still mentioned" : "still not mentioned"}</Chip> : <Chip tone="neutral" noIcon>unknown (a check failed)</Chip>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="dt m-0">Answers vary between checks even with identical setup. Treat single-question changes as observations, not trends.</p>
    </section>
  );
}
