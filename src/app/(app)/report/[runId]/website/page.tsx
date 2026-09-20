import { requireBusiness, loadRunReport } from "@/server/data";
import { PageTitle, EmptyState, Notice, Chip, formatDate } from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { ReportHeader } from "../ReportHeader";

const CATEGORY_LABEL = { services: "Services", location: "Location", contact: "Contact", technical: "Technical" } as const;

export default async function WebsitePage({ params }: { params: Promise<{ runId: string }> }) {
  const { business } = await requireBusiness();
  const { runId } = await params;
  const { run, audit } = loadRunReport(business, runId);
  return (
    <>
      <PageTitle sub={`A live read of ${business.websiteDomain}, checking for clear service, location, and contact information.`}>Website audit</PageTitle>
      <ReportHeader run={run} current="website" />
      {!audit ? (
        <EmptyState title="The website audit has not finished yet.">Refresh in a moment.</EmptyState>
      ) : audit.status === "failed_fetch" ? (
        <Notice kind="error">We couldn&apos;t reach your website: {audit.errorMessage ?? "unknown reason"}. Check the address in Settings and run the check again.</Notice>
      ) : (
        <>
          <p className="dt mb-5">Checked {formatDate(audit.finishedAt)}. This audit reads your live site; it is not sample data.</p>
          {(Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map((cat) => {
            const items = audit.findings.filter((f) => f.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="mb-6">
                <h2 className="k mb-2.5">{CATEGORY_LABEL[cat]}</h2>
                <ul className="card m-0 list-none gap-0 p-0">
                  {items.map((f, i) => (
                    <li key={f.id} className={`flex flex-col gap-1.5 p-3 ${i ? "rowline" : ""}`}>
                      <div className="row flex-wrap gap-2">
                        {f.severity === "good" ? <Chip tone="good">Good</Chip> : f.severity === "warn" ? <Chip tone="warn">Needs attention</Chip> : <Chip tone="bad">Missing</Chip>}
                        <span className="font-medium">{f.title}</span>
                      </div>
                      <p className="m2 m-0 text-[14px]">{f.detail}</p>
                      {f.evidence?.excerpt ? <p className="m2 m-0 border-l-2 border-line2 pl-3 text-[12.5px]">&ldquo;{f.evidence.excerpt}&rdquo;</p> : null}
                      {f.pageUrl ? <a href={f.pageUrl} target="_blank" rel="noopener noreferrer" className="row gap-1 break-all text-[12px]">{f.pageUrl}<IconExternal width={12} height={12} /></a> : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
      {audit ? (
        <section>
          <h2 className="k mb-2.5">Pages we checked</h2>
          <ul className="card m-0 list-none gap-0 p-0 text-[13px]">
            {audit.pages.map((p, i) => (
              <li key={p.url} className={`flex flex-wrap items-center justify-between gap-2 p-2.5 ${i ? "rowline" : ""}`}>
                <span className="break-all font-mono text-[12px]">{p.url}</span>
                {p.fetched ? <Chip tone="good">read ({p.status})</Chip> : <Chip tone="warn">{p.error ?? "not read"}</Chip>}
              </li>
            ))}
          </ul>
          <p className="dt mt-2">We read up to 12 pages as plain HTML. Content that only appears after scripts run may be missed.</p>
        </section>
      ) : null}
    </>
  );
}
