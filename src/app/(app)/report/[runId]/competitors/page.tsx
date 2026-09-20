import Link from "next/link";
import { requireBusiness, loadRunReport } from "@/server/data";
import { PageTitle, EmptyState, Notice, Chip, CompetitorBar } from "@/components/ui";
import { ReportHeader } from "../ReportHeader";

export default async function CompetitorsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { business } = await requireBusiness();
  const { runId } = await params;
  const { run, metrics, mentions, checks, citations } = loadRunReport(business, runId);
  const n = metrics.successfulChecks;
  const questionText = new Map(checks.map((c) => [c.questionId, c.questionText]));
  return (
    <>
      <PageTitle sub="Businesses named in the answers, counted once per answer.">Who else appears?</PageTitle>
      <ReportHeader run={run} current="competitors" />
      {run.summary?.competitorExtraction === "unavailable" ? (
        <div className="mb-4"><Notice kind="warning">We could not identify competitors for this check because the analysis service was not available. Only your own business was detected.</Notice></div>
      ) : null}
      <div className="card mb-4 gap-2 p-4">
        <span className="font-medium">{business.name} <span className="m2">(you)</span></span>
        <CompetitorBar name="Mentioned" count={metrics.mentionRate.numerator} total={n} you wide />
        <div className="dt">Recommended in {metrics.recommendationRate.numerator} of {n} · website cited in {metrics.citationRate.numerator} of {n}</div>
      </div>
      {metrics.competitors.length === 0 ? (
        <EmptyState title="No other businesses were named in these answers." />
      ) : (
        <div className="flex flex-col gap-3">
          {metrics.competitors.map((c) => {
            const evidence = mentions.filter((m) => m.normalizedName === c.normalizedName && !m.isOwner);
            const citedBy = new Map<string, number>();
            for (const cid of c.checkIds) for (const ci of citations.filter((x) => x.checkId === cid)) citedBy.set(ci.domain, (citedBy.get(ci.domain) ?? 0) + 1);
            const topSources = [...citedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <details key={c.normalizedName} className="card gap-0 p-4">
                <summary className="flex min-h-11 cursor-pointer flex-col gap-2 sm:min-h-0">
                  <span className="font-medium">{c.name}</span>
                  <CompetitorBar name={`mentioned in ${c.mentioned} of ${n}`} count={c.mentioned} total={n} wide />
                  <span className="dt">Recommended in {c.recommended} of {n}</span>
                </summary>
                <div className="mt-4 flex flex-col gap-4 text-[14px]">
                  <div>
                    <p className="k m-0">Questions where they appear</p>
                    <div className="row mt-2 flex-wrap gap-1.5">{c.questionIds.map((q) => <Chip key={q} tone="neutral" noIcon>{questionText.get(q) ?? q}</Chip>)}</div>
                  </div>
                  {topSources.length ? (
                    <div>
                      <p className="k m-0">Sources cited in those answers</p>
                      <p className="m2 m-0 mt-2">{topSources.map(([d, k]) => `${d} (${k})`).join(", ")}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="k m-0">What the answers said</p>
                    <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                      {evidence.slice(0, 5).map((m) => (
                        <li key={m.id} className="border-l-2 border-line2 pl-3">
                          <span className="m2">&ldquo;{m.evidenceText}&rdquo;</span> <Link href={`/report/${run.id}/answers#check-${m.checkId}`}>see answer</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
      <p className="dt mt-6">Competitor names are extracted from the stored answers and each one is backed by a quoted excerpt. Extraction method for this check: {run.summary?.competitorExtraction ?? "unknown"}.</p>
    </>
  );
}
