import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireBusiness } from "@/server/data";
import { getRun } from "@/lib/collect/runs";
import { PageTitle } from "@/components/ui";
import { RunProgress } from "./RunProgress";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const run = getRun(getDb(), id);
  if (!run || run.businessId !== business.id) notFound();
  return (
    <>
      <PageTitle sub="This usually takes a minute or two. You can leave this page and come back.">Running your check</PageTitle>
      <RunProgress runId={id} />
    </>
  );
}
