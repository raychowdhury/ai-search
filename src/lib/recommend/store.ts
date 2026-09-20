import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { EvidenceRef, Effort, Recommendation } from "./rules";

export type ActionStatus = "pending" | "in_progress" | "done" | "skipped";
/** Separate from the owner's workflow status: what a later check actually observed. */
export type VerificationStatus = "not_checked" | "queued" | "verified_fixed" | "still_observed" | "unable_to_verify" | "recurred";

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
  needsConfirmation: string[];
  effort: Effort;
  status: ActionStatus;
  statusChangedAt: string | null;
  scope: string;
  verifyRules: string[];
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  verificationNote: string | null;
  createdAt: string;
}

interface Row {
  id: string; run_id: string; business_id: string; rank: number; rule_id: string; title: string; why: string; evidence: string;
  suggested_copy: string | null; effort: Effort; status: ActionStatus; status_changed_at: string | null; created_at: string;
  scope: string; verification_status: VerificationStatus; verified_at: string | null; verification_note: string | null;
}

interface ScopePayload {
  scope: string;
  verifyRules: string[];
  needsConfirmation: string[];
}

function parseScope(raw: string): ScopePayload {
  try {
    const p = JSON.parse(raw) as Partial<ScopePayload>;
    return { scope: p.scope ?? "", verifyRules: p.verifyRules ?? [], needsConfirmation: p.needsConfirmation ?? [] };
  } catch {
    return { scope: raw, verifyRules: [], needsConfirmation: [] };
  }
}

function toRec(r: Row): StoredRecommendation {
  const sp = parseScope(r.scope ?? "");
  return {
    id: r.id, runId: r.run_id, businessId: r.business_id, rank: r.rank, ruleId: r.rule_id, title: r.title, why: r.why,
    evidence: JSON.parse(r.evidence) as EvidenceRef[], suggestedCopy: r.suggested_copy, needsConfirmation: sp.needsConfirmation,
    effort: r.effort, status: r.status, statusChangedAt: r.status_changed_at, scope: sp.scope, verifyRules: sp.verifyRules,
    verificationStatus: r.verification_status ?? "not_checked", verifiedAt: r.verified_at, verificationNote: r.verification_note,
    createdAt: r.created_at,
  };
}

export interface SaveResult {
  recommendations: StoredRecommendation[];
  /** Rule ids that the owner had marked done but whose finding is observed again. */
  recurred: string[];
}

/**
 * Stores the ranked recommendations for a run. Completion status carries over only
 * from an earlier recommendation with the same rule AND the same scope. If the
 * owner had marked that scope done and the finding is observed again, the status
 * is kept for history but verification is set to "recurred".
 */
export function saveRecommendations(db: Db, runId: string, businessId: string, recs: Recommendation[]): SaveResult {
  const ts = nowIso();
  const recurred: string[] = [];
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM recommendations WHERE run_id = ?").run(runId);
    const insert = db.prepare(
      `INSERT INTO recommendations (id, run_id, business_id, rank, rule_id, title, why, evidence, suggested_copy, effort, status, status_changed_at, scope, verification_status, verified_at, verification_note, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    recs.forEach((r, i) => {
      const prior = db
        .prepare("SELECT status, status_changed_at, scope, verification_status FROM recommendations WHERE business_id = ? AND rule_id = ? AND run_id != ? ORDER BY created_at DESC LIMIT 1")
        .get(businessId, r.ruleId, runId) as { status: ActionStatus; status_changed_at: string | null; scope: string; verification_status: VerificationStatus } | undefined;
      const sameScope = prior ? parseScope(prior.scope ?? "").scope === r.scope : false;
      let status: ActionStatus = "pending";
      let statusChangedAt: string | null = null;
      let verification: VerificationStatus = "not_checked";
      let note: string | null = null;
      if (prior && sameScope && (prior.status === "done" || prior.status === "in_progress")) {
        status = prior.status;
        statusChangedAt = prior.status_changed_at;
        if (prior.status === "done") {
          verification = "recurred";
          note = "You marked this done earlier, but the same issue was observed again in this check.";
          recurred.push(r.ruleId);
        }
      } else if (prior && !sameScope && prior.status === "done") {
        note = "A similar action was marked done before, but this one covers a different page or service, so it starts fresh.";
      }
      const scopePayload: ScopePayload = { scope: r.scope, verifyRules: r.verifyRules, needsConfirmation: r.needsConfirmation };
      insert.run(newId(), runId, businessId, i + 1, r.ruleId, r.title, r.why, JSON.stringify(r.evidence), r.suggestedCopy, r.effort, status, statusChangedAt, JSON.stringify(scopePayload), verification, null, note, ts, ts);
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { recommendations: recommendationsForRun(db, runId), recurred };
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

export function setVerification(db: Db, id: string, status: VerificationStatus, note: string | null): void {
  const ts = nowIso();
  const verifiedAt = status === "verified_fixed" || status === "still_observed" || status === "unable_to_verify" ? ts : null;
  db.prepare("UPDATE recommendations SET verification_status = ?, verified_at = COALESCE(?, verified_at), verification_note = ?, updated_at = ? WHERE id = ?").run(status, verifiedAt, note, ts, id);
}
