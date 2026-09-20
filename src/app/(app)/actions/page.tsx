import Link from "next/link";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/server/data";
import { latestCompleteRun } from "@/lib/collect/runs";
import { recommendationsForRun } from "@/lib/recommend/store";
import { PageTitle, EmptyState, LinkButton, Chip, DataModeBadge, formatDate } from "@/components/ui";
import { ActionStatusForm, StatusChip } from "@/components/report";
import { CopyButton } from "@/components/CopyButton";

export default async function ActionsPage() {
  const { business } = await requireBusiness();
  const db = getDb();
  const run = latestCompleteRun(db, business.id);
  if (!run) {
    return (
      <>
        <PageTitle>Actions</PageTitle>
        <EmptyState title="Actions appear after your first completed check." action={<LinkButton href="/questions">Run a check</LinkButton>} />
      </>
    );
  }
  const recs = recommendationsForRun(db, run.id);
  return (
    <>
      <PageTitle sub="Three prioritized improvement opportunities from your latest check, with the evidence behind each one.">Actions</PageTitle>
      <div className="row mb-5 flex-wrap gap-x-3.5 gap-y-2 text-[13px]">
        <DataModeBadge mode={run.dataMode} />
        <span className="m2">From the check on {formatDate(run.finishedAt)}</span>
        <Link href={`/dashboard?run=${run.id}`}>Dashboard</Link>
      </div>
      {recs.length === 0 ? (
        <EmptyState title="No actions could be derived from this check." />
      ) : (
        <div className="flex flex-col gap-4">
          {recs.map((rec) => (
            <section key={rec.id} id={`action-${rec.id}`} className="card scroll-mt-4 gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="row gap-2"><span className="m3 font-mono text-[12px]">{String(rec.rank).padStart(2, "0")}</span><Chip tone="neutral" noIcon>effort: {rec.effort}</Chip><StatusChip status={rec.status} /></div>
                  <h2 className="text-[17px]">{rec.title}</h2>
                  {rec.statusChangedAt ? <span className="dt">Status changed {formatDate(rec.statusChangedAt)}</span> : null}
                </div>
                <ActionStatusForm rec={rec} back="/actions" />
              </div>
              <div className="flex flex-col gap-4 text-[14px]">
                <div>
                  <p className="k m-0">Why we suggest this</p>
                  <p className="m-0 mt-2 leading-relaxed">{rec.why}</p>
                </div>
                <div>
                  <p className="k m-0">Evidence</p>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                    {rec.evidence.map((e, i) => (
                      <li key={i} className="border-l-2 border-line2 pl-3">
                        <span className="m2">{e.excerpt}</span>{" "}
                        {e.type === "check" ? <Link href={`/report/${run.id}/answers#check-${e.id}`}>see answer</Link> : e.type === "finding" ? <Link href={`/report/${run.id}/website`}>see audit</Link> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                {rec.suggestedCopy ? (
                  <div>
                    <p className="k m-0">Suggested wording</p>
                    <p className="dt m-0 mt-2">Replace anything in [brackets] with your real details.</p>
                    <div className="relative mt-1.5"><pre className="copyblk m-0 pr-24">{rec.suggestedCopy}</pre><CopyButton text={rec.suggestedCopy} /></div>
                  </div>
                ) : null}
                <p className="dt m-0">This is an improvement opportunity based on what we observed. AI answers can change for many reasons, so completing it does not guarantee a change in visibility.</p>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
