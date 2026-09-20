import Link from "next/link";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/server/data";
import { latestCompleteRun } from "@/lib/collect/runs";
import { recommendationsForRun, type StoredRecommendation } from "@/lib/recommend/store";
import { PageTitle, EmptyState, LinkButton, Chip, DataModeBadge, Notice, chipIcons, formatDate } from "@/components/ui";
import { ActionStatusForm, StatusChip } from "@/components/report";
import { CopyButton } from "@/components/CopyButton";
import { recheckActionAction } from "@/server/actions/runs";

function VerificationChip({ rec }: { rec: StoredRecommendation }) {
  switch (rec.verificationStatus) {
    case "verified_fixed":
      return <Chip tone="good">Verified fixed</Chip>;
    case "still_observed":
      return <Chip tone="warn">Still observed</Chip>;
    case "recurred":
      return <Chip tone="warn">Came back</Chip>;
    case "unable_to_verify":
      return <Chip tone="neutral" icon={chipIcons.minus}>Could not verify</Chip>;
    case "queued":
      return <Chip tone="ink" icon={chipIcons.running}>Checking</Chip>;
    default:
      return null;
  }
}

function instructionsFor(rec: StoredRecommendation, businessName: string): string {
  const lines = [
    `${businessName}: website change request`,
    ``,
    `What to do: ${rec.title}`,
    ``,
    `Why: ${rec.why}`,
    ``,
    `Evidence:`,
    ...rec.evidence.map((e) => `- ${e.excerpt}`),
  ];
  if (rec.suggestedCopy) lines.push(``, `Suggested wording (replace anything in [brackets]):`, ``, rec.suggestedCopy);
  if (rec.needsConfirmation.length) lines.push(``, `Still needs confirming with the owner: ${rec.needsConfirmation.join(", ")}.`);
  lines.push(``, `Note: this is an improvement opportunity based on observed AI answers and a read of the website. It does not guarantee a change in AI visibility.`);
  return lines.join("\n");
}

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
      {!business.factsConfirmedAt ? (
        <div className="mb-4"><Notice kind="info">Suggested wording leaves out anything you have not confirmed. Add your phone, hours, and how you serve customers in <Link href="/onboarding">your business details</Link> to get complete drafts.</Notice></div>
      ) : null}
      {recs.length === 0 ? (
        <EmptyState title="No actions could be derived from this check." />
      ) : (
        <div className="flex flex-col gap-4">
          {recs.map((rec) => (
            <section key={rec.id} id={`action-${rec.id}`} className="card scroll-mt-4 gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="row flex-wrap gap-2"><span className="m3 font-mono text-[12px]">{String(rec.rank).padStart(2, "0")}</span><Chip tone="neutral" noIcon>effort: {rec.effort}</Chip><StatusChip status={rec.status} /><VerificationChip rec={rec} /></div>
                  <h2 className="text-[17px]">{rec.title}</h2>
                  {rec.statusChangedAt ? <span className="dt">Status changed {formatDate(rec.statusChangedAt)}</span> : null}
                </div>
                <ActionStatusForm rec={rec} back="/actions" />
              </div>
              {rec.verificationNote ? (
                <Notice kind={rec.verificationStatus === "verified_fixed" ? "success" : rec.verificationStatus === "still_observed" || rec.verificationStatus === "recurred" ? "warning" : "info"}>
                  {rec.verificationNote}{rec.verifiedAt ? ` Checked ${formatDate(rec.verifiedAt)}.` : ""}
                  {rec.status === "done" && rec.verificationStatus !== "queued" && rec.verifyRules.length > 0 ? (
                    <form action={recheckActionAction} className="mt-2"><input type="hidden" name="id" value={rec.id} /><button type="submit" className="btn btn-sm">Check again</button></form>
                  ) : null}
                </Notice>
              ) : null}
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
                        <span className="m2 break-words">{e.excerpt}</span>{" "}
                        {e.type === "check" ? <Link href={`/report/${run.id}/answers#check-${e.id}`}>see answer</Link> : e.type === "citation" ? <Link href={`/report/${run.id}/answers#check-${e.checkId}`}>see answer</Link> : e.type === "finding" ? <Link href={`/report/${run.id}/website`}>see audit</Link> : <Link href={`/report/${run.id}/website`}>see audit</Link>}
                      </li>
                    ))}
                  </ul>
                </div>
                {rec.suggestedCopy ? (
                  <div>
                    <p className="k m-0">Suggested wording</p>
                    <p className="dt m-0 mt-2">{rec.needsConfirmation.length ? `Draft, not ready to publish: still needs ${rec.needsConfirmation.join(", ")}. Replace anything in [brackets] with your real details.` : "Built only from details you confirmed. Replace anything in [brackets] before publishing."}</p>
                    <div className="relative mt-1.5"><pre className="copyblk m-0 pr-24">{rec.suggestedCopy}</pre><CopyButton text={rec.suggestedCopy} /></div>
                  </div>
                ) : null}
                <div className="row flex-wrap gap-2">
                  <div className="relative"><CopyButton text={instructionsFor(rec, business.name)} label="Copy instructions for your web person" inline /></div>
                </div>
                <p className="dt m-0">This is an improvement opportunity based on what we observed. AI answers can change for many reasons, so completing it does not guarantee a change in visibility. Marking it done asks us to read your site again; we only call it fixed when that read no longer shows the issue.</p>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
