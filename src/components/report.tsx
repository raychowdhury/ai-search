import type { Check } from "@/lib/collect/runs";
import type { MentionRecord, CitationRecord } from "@/lib/analyze/store";
import { PLATFORM_LABELS } from "@/lib/platforms/types";
import { Chip, chipIcons, PlatformBadge, formatDate } from "./ui";
import type { StoredRecommendation } from "@/lib/recommend/store";
import { setActionStatusAction } from "@/server/actions/runs";
import { IconExternal } from "./icons";

const REASONS: Record<string, string> = {
  demo_simulated_outage: "simulated outage (sample data)",
  rate_limited: "the platform was busy",
  provider_unavailable: "the platform was unavailable",
  network_error: "we could not reach the platform",
  refusal: "the platform declined to answer",
  auth_failed: "the API key was rejected",
  empty_answer: "no answer text was returned",
  provider_response_invalid: "the platform sent an unexpected response",
  timeout: "the platform took too long",
  gave_up: "did not complete after retries",
  monthly_cap: "monthly request limit reached for this platform",
  grounding_quota: "Gemini web grounding is not enabled on this Google project (free tier)",
};

export function failureReason(code: string | null): string {
  return REASONS[code ?? ""] ?? `unknown problem (${code ?? "no code"})`;
}

/** Answer text with owner mentions highlighted, using stored evidence offsets only. */
function Highlighted({ text, mentions }: { text: string; mentions: MentionRecord[] }) {
  const owner = mentions.filter((m) => m.isOwner).sort((a, b) => a.evidenceStart - b.evidenceStart);
  if (!owner.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  owner.forEach((m, i) => {
    if (m.evidenceStart < cursor) return;
    parts.push(text.slice(cursor, m.evidenceStart));
    parts.push(<mark key={i}>{text.slice(m.evidenceStart, m.evidenceEnd)}</mark>);
    cursor = m.evidenceEnd;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function AnswerCard({ check, mentions, citations, anchor }: { check: Check; mentions: MentionRecord[]; citations: CitationRecord[]; anchor?: boolean }) {
  const ownerMentioned = mentions.some((m) => m.isOwner);
  const ownerRecommended = mentions.some((m) => m.isOwner && m.isRecommended);
  const ownerCited = citations.some((c) => c.isOwnerDomain);
  return (
    <article id={anchor ? `check-${check.id}` : undefined} className="card gap-3 p-4 scroll-mt-4">
      <div className="row flex-wrap gap-2 text-[12px]">
        <PlatformBadge label={PLATFORM_LABELS[check.platform]} />
        <span className="m2">Collected through the API on {formatDate(check.completedAt ?? check.requestedAt)}</span>
        {check.model ? <span className="m3">· {check.model}</span> : null}
      </div>
      {check.status === "success" ? (
        <>
          <div className="row flex-wrap gap-1.5">
            {ownerMentioned ? <Chip tone="good">Mentioned</Chip> : <Chip tone="neutral" icon={chipIcons.minus}>Not mentioned</Chip>}
            {ownerRecommended ? <Chip tone="good">Recommended</Chip> : null}
            {ownerCited ? <Chip tone="good">Your website cited</Chip> : null}
          </div>
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer items-center text-[14px] text-link sm:min-h-0">Show the full answer</summary>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">
              <Highlighted text={check.answerText ?? ""} mentions={mentions} />
            </p>
          </details>
          {check.analysisNote ? <p className="dt m-0">{check.analysisNote}</p> : null}
          <div>
            <p className="k m-0">Sources cited</p>
            {check.evidenceStatus === "unparseable" || check.evidenceStatus === "missing" ? (
              <p className="m2 m-0 mt-2 text-[13px]">Source evidence for this answer could not be read, so we cannot say what it cited. Run a new check to collect it again.</p>
            ) : citations.length ? (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                {citations.map((c) => (
                  <li key={c.id} className="row flex-wrap gap-2">
                    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="row gap-1 break-all">{c.title ?? c.url}<IconExternal width={12} height={12} /></a>
                    <span className="dt">{c.domain}</span>
                    {c.isOwnerDomain ? <Chip tone="good">your site</Chip> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m2 m-0 mt-2 text-[13px]">No sources were returned for this answer.</p>
            )}
          </div>
        </>
      ) : (
        <div><Chip tone="bad">Failed: {failureReason(check.errorCode)}</Chip></div>
      )}
    </article>
  );
}

export function ActionStatusForm({ rec, back }: { rec: StoredRecommendation; back: string }) {
  return (
    <form action={setActionStatusAction} className="row gap-2">
      <input type="hidden" name="id" value={rec.id} />
      <input type="hidden" name="back" value={back} />
      <label htmlFor={`status-${rec.id}`} className="sr-only">Status</label>
      <select id={`status-${rec.id}`} name="status" defaultValue={rec.status} className="sel min-h-11 sm:min-h-9">
        <option value="pending">Not started</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
        <option value="skipped">Skipped</option>
      </select>
      <button type="submit" className="btn btn-sm min-h-11 sm:min-h-9">Update</button>
    </form>
  );
}

export function StatusChip({ status }: { status: "pending" | "in_progress" | "done" | "skipped" }) {
  if (status === "done") return <Chip tone="good">Done</Chip>;
  if (status === "in_progress") return <Chip tone="ink">In progress</Chip>;
  if (status === "skipped") return <Chip tone="neutral" noIcon>Skipped</Chip>;
  return <Chip tone="neutral" noIcon>Not started</Chip>;
}
