import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { EvidenceRef, Effort, Recommendation } from "./rules";

export type ActionStatus = "pending" | "in_progress" | "done" | "skipped";

export interface StoredRecommendation {
  id: string;
  runId: string;
  businessId: string;
  rank: number;
  ruleId: string;
  title: string;
  why: string;
  evidence: EvidenceRef[];
  suggestedCopy: string | null;
  effort: Effort;
  status: ActionStatus;
  statusChangedAt: string | null;
  createdAt: string;
}

interface Row {
  id: string; run_id: string; business_id: string; rank: number; rule_id: string; title: string; why: string; evidence: string;
  suggested_copy: string | null; effort: Effort; status: ActionStatus; status_changed_at: string | null; created_at: string;
}

function toRec(r: Row): StoredRecommendation {
  return {
    id: r.id, runId: r.run_id, businessId: r.business_id, rank: r.rank, ruleId: r.rule_id, title: r.title, why: r.why,
    evidence: JSON.parse(r.evidence) as EvidenceRef[], suggestedCopy: r.suggested_copy, effort: r.effort, status: r.status,
    statusChangedAt: r.status_changed_at, createdAt: r.created_at,
  };
}

/**
 * Stores the ranked recommendations for a run. Status carries over from the most
 * recent earlier recommendation with the same rule id, so a task marked done stays done.
 */
export function saveRecommendations(db: Db, runId: string, businessId: string, recs: Recommendation[]): StoredRecommendation[] {
  const ts = nowIso();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM recommendations WHERE run_id = ?").run(runId);
    const insert = db.prepare(
      `INSERT INTO recommendations (id, run_id, business_id, rank, rule_id, title, why, evidence, suggested_copy, effort, status, status_changed_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    recs.forEach((r, i) => {
      const prior = db
        .prepare("SELECT status, status_changed_at FROM recommendations WHERE business_id = ? AND rule_id = ? AND run_id != ? ORDER BY created_at DESC LIMIT 1")
        .get(businessId, r.ruleId, runId) as { status: ActionStatus; status_changed_at: string | null } | undefined;
      const status = prior?.status === "done" || prior?.status === "in_progress" ? prior.status : "pending";
      insert.run(newId(), runId, businessId, i + 1, r.ruleId, r.title, r.why, JSON.stringify(r.evidence), r.suggestedCopy, r.effort, status, prior?.status_changed_at ?? null, ts, ts);
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return recommendationsForRun(db, runId);
}

export function recommendationsForRun(db: Db, runId: string): StoredRecommendation[] {
  return (db.prepare("SELECT * FROM recommendations WHERE run_id = ? ORDER BY rank").all(runId) as unknown as Row[]).map(toRec);
}

export function getRecommendation(db: Db, id: string): StoredRecommendation | null {
  const row = db.prepare("SELECT * FROM recommendations WHERE id = ?").get(id) as unknown as Row | undefined;
  return row ? toRec(row) : null;
}

export function setRecommendationStatus(db: Db, id: string, businessId: string, status: ActionStatus): boolean {
  const ts = nowIso();
  const res = db
    .prepare("UPDATE recommendations SET status = ?, status_changed_at = ?, updated_at = ? WHERE id = ? AND business_id = ?")
    .run(status, ts, ts, id, businessId);
  return res.changes > 0;
}
