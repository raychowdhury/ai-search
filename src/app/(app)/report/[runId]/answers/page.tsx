import { requireBusiness, loadRunReport } from "@/server/data";
import { PageTitle, EmptyState, MetricSentence } from "@/components/ui";
import { AnswerCard } from "@/components/report";
import { ReportHeader } from "../ReportHeader";

export default async function AnswersPage({ params }: { params: Promise<{ runId: string }> }) {
  const { business } = await requireBusiness();
  const { runId } = await params;
  const { run, checks, mentions, citations, metrics } = loadRunReport(business, runId);
  const questionIds = [...new Set(checks.map((c) => c.questionId))];
  return (
    <>
      <PageTitle sub={`${metrics.successfulChecks} successful answers, ${metrics.failedChecks} failed checks${metrics.pendingChecks ? `, ${metrics.pendingChecks} pending` : ""}.`}>The answers</PageTitle>
      <ReportHeader run={run} current="answers" />
      <div className="mb-6"><MetricSentence label="Mentioned" numerator={metrics.mentionRate.numerator} denominator={metrics.mentionRate.denominator} big /></div>
      {checks.length === 0 ? <EmptyState title="No checks in this run" /> : null}
      <div className="flex flex-col gap-8">
        {questionIds.map((qid) => {
          const group = checks.filter((c) => c.questionId === qid);
          return (
            <section key={qid} className="flex flex-col gap-3">
              <h2 className="text-[17px]">{group[0].questionText}</h2>
              {group.map((check) => (
                <AnswerCard key={check.id} anchor check={check} mentions={mentions.filter((m) => m.checkId === check.id)} citations={citations.filter((c) => c.checkId === check.id)} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
