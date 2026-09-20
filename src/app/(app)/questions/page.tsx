import { getDb } from "@/db/client";
import { requireBusiness } from "@/server/data";
import { getCurrentQuestionSet, saveQuestionSet, newQuestion } from "@/lib/questions/repo";
import { suggestQuestions } from "@/lib/questions/suggest";
import { configuredLiveAdapters } from "@/lib/platforms/registry";
import { estimateRunCostUsd, formatUsd } from "@/lib/metrics/cost";
import { questionsAndRunAction } from "@/server/actions/runs";
import { regenerateQuestionsAction } from "@/server/actions/business";
import { PageTitle } from "@/components/ui";
import { QuestionEditor } from "./QuestionEditor";

export default async function QuestionsPage() {
  const { business } = await requireBusiness();
  const db = getDb();
  let qs = getCurrentQuestionSet(db, business.id);
  if (!qs) qs = saveQuestionSet(db, business.id, suggestQuestions(business).map((t) => newQuestion(t, "suggested")));
  const live = configuredLiveAdapters();
  const estimate = live.length ? formatUsd(estimateRunCostUsd(qs.questions.length, live.map((a) => a.id))) : null;
  return (
    <>
      <PageTitle sub="Review the questions we will ask, then run a check.">Customer questions</PageTitle>
      <QuestionEditor key={qs.id} initial={qs.questions} version={qs.version} liveAvailable={live.length > 0} livePlatforms={live.map((a) => a.label.replace(/\s*\(.*\)\s*$/, ""))} costEstimate={estimate} action={questionsAndRunAction} />
      <form action={regenerateQuestionsAction} className="mt-8">
        <button type="submit" className="btn btn-ghost px-0">Start over with suggested questions</button>
      </form>
    </>
  );
}
