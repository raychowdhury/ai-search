import { describe, it, expect } from "vitest";
import { openDatabase } from "@/db/client";
import { enqueue, claimNext, completeJob, failJob, countPending } from "@/lib/jobs/queue";

describe("job queue", () => {
  it("claims in order, retries with backoff, and fails after max attempts", () => {
    const db = openDatabase(":memory:");
    enqueue(db, "run_checks", { runId: "a" });
    enqueue(db, "website_audit", { businessId: "b" }, new Date(Date.now() + 60_000));
    const j1 = claimNext(db);
    expect(j1?.type).toBe("run_checks");
    expect(claimNext(db)).toBeNull(); // second job is scheduled in the future
    completeJob(db, j1!.id);
    expect(countPending(db)).toBe(1);

    const j2 = claimNext(db, new Date(Date.now() + 61_000));
    expect(j2?.type).toBe("website_audit");
    failJob(db, j2!, "boom", true);
    const j2b = claimNext(db, new Date(Date.now() + 120_000));
    expect(j2b?.id).toBe(j2!.id);
    expect(j2b?.attempts).toBe(2);
    failJob(db, j2b!, "boom", false);
    expect(claimNext(db, new Date(Date.now() + 999_000))).toBeNull();
  });

  it("reclaims jobs whose lock expired", () => {
    const db = openDatabase(":memory:");
    enqueue(db, "analyze_run", { runId: "x" });
    const j = claimNext(db);
    expect(j).not.toBeNull();
    expect(claimNext(db)).toBeNull();
    const later = new Date(Date.now() + 11 * 60 * 1000);
    expect(claimNext(db, later)?.id).toBe(j!.id);
  });
});
