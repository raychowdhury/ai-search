import Link from "next/link";
import { requireBusiness } from "@/server/data";
import { adapterStatus } from "@/lib/platforms/registry";
import { isClaudeExtractorConfigured } from "@/lib/analyze/claudeExtractor";
import { setScheduleAction, deleteAccountAction } from "@/server/actions/business";
import { PageTitle, Card, CardTitle, Notice, Button, Chip, inputClass } from "@/components/ui";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { business } = await requireBusiness();
  const { saved, error } = await searchParams;
  const platforms = adapterStatus();
  return (
    <>
      <PageTitle>Settings</PageTitle>
      {saved ? <div className="mb-4"><Notice kind="success">Saved.</Notice></div> : null}
      {error === "confirm" ? <div className="mb-4"><Notice kind="error">Type DELETE to confirm account deletion.</Notice></div> : null}
      <div className="flex flex-col gap-4">
        <Card className="gap-1.5">
          <CardTitle>Business details</CardTitle>
          <p className="m-0 text-[14px]">{business.name} · {business.category} · {business.city}, {business.region}, {business.country}</p>
          <p className="m-0 font-mono text-[12.5px]">{business.websiteUrl}</p>
          <p className="m2 m-0 text-[14px]">Services: {business.services.join(", ")}</p>
          <Link href="/onboarding" className="mt-1 inline-block text-[14px]">Edit details</Link>
          <p className="dt m-0 mt-1">Changing city, region, or country changes the location context, so later checks will not be comparable with earlier ones.</p>
        </Card>

        <Card className="gap-2">
          <CardTitle>AI platforms</CardTitle>
          <ul className="m-0 flex list-none flex-col p-0 text-[14px]">
            {platforms.map((p, i) => (
              <li key={p.id} className={`row justify-between gap-2 py-2 ${i ? "rowline" : ""}`}>
                <span>{p.label.replace(/\s*\(.*\)\s*$/, "")} <span className="m3">· {p.dataMode === "demo" ? "sample" : "API"}</span></span>
                {p.dataMode === "demo" ? <Chip tone="sample">sample only</Chip> : p.configured ? <Chip tone="good">connected</Chip> : <Chip tone="neutral" noIcon>not connected</Chip>}
              </li>
            ))}
          </ul>
          <p className="row m-0 gap-2 text-[14px]">Competitor extraction {isClaudeExtractorConfigured() ? <Chip tone="good">available</Chip> : <Chip tone="warn">unavailable</Chip>}</p>
          <p className="dt m-0">Platforms are connected by setting API keys in the server environment. Answers come from each platform&apos;s API, which is not identical to its consumer app.</p>
        </Card>

        <Card className="gap-3">
          <CardTitle>Repeat checks automatically</CardTitle>
          <form action={setScheduleAction} className="flex flex-wrap items-end gap-3">
            <div className="field">
              <label htmlFor="schedule">Schedule</label>
              <select id="schedule" name="schedule" defaultValue={business.schedule} className={inputClass}>
                <option value="off">Off (run checks manually)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">Save schedule</Button>
          </form>
          <p className="dt m-0">Scheduled checks use your current questions and connected live platforms, so they stay comparable. Each check uses API credit. Sample checks are never scheduled.</p>
        </Card>

        <Card className="gap-3">
          <CardTitle>Delete account</CardTitle>
          <p className="m-0 text-[14px]">This removes your business details, questions, every stored answer, audit, and action. It cannot be undone.</p>
          <form action={deleteAccountAction} className="flex flex-wrap items-end gap-3">
            <div className="field">
              <label htmlFor="confirm">Type DELETE to confirm</label>
              <input id="confirm" name="confirm" className={inputClass} autoComplete="off" />
            </div>
            <Button type="submit" variant="danger">Delete my account</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
