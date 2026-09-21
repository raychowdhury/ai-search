import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { Business, LocationContext } from "@/lib/business/schema";
import { locationOf } from "@/lib/business/schema";
import type { QuestionSet } from "@/lib/questions/repo";
import type { DataMode, PlatformId } from "@/lib/platforms/types";
import { enqueue } from "@/lib/jobs/queue";

export type RunStatus = "queued" | "running" | "complete" | "failed";
export type CheckStatus = "queued" | "running" | "success" | "failed";

export interface Run {
  id: string;
  businessId: string;
  questionSetId: string;
  questionSetVersion: number;
  platforms: PlatformId[];
  locationContext: LocationContext;
  dataMode: DataMode;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  summary: RunSummary | null;
  analysisNote: string | null;
  /** Measurement configuration at creation; null on runs created before fingerprints existed. */
  fingerprint: RunFingerprint | null;
  createdAt: string;
}

/** What was measured and how. Two runs compare only when fingerprints match. */
export interface RunFingerprint {
  collection: "api" | "demo";
  /** Platform id -> configured model (or "unknown" when the provider chooses). */
  models: Record<string, string>;
  extractionModel: string | null;
  extractionVersion: string;
  promptTemplate: string;
  repetition: number;
  language: string;
}

export interface RunSummary {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  ownerMentioned: number;
  ownerRecommended: number;
  ownerCited: number;
  /** llm = every successful answer analyzed by the model; partial = some fell back; unavailable = none. */
  competitorExtraction: "llm" | "demo" | "partial" | "unavailable";
  /** Successful answers whose competitor extraction did not run or failed. */
  extractionUnavailable: number;
  /** Successful answers whose stored evidence could not be read. */
  evidenceUnreadable: number;
}

export interface Check {
  id: string;
  runId: string;
  questionId: string;
  questionText: string;
  platform: PlatformId;
  model: string | null;
  locationContext: LocationContext;
  status: CheckStatus;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  requestedAt: string | null;
  completedAt: string | null;
  answerText: string | null;
  usage: Record<string, unknown> | null;
  dataMode: DataMode;
  /** full: whole provider response stored; provider_truncated: raw provider body dropped, citations kept; unparseable: stored evidence cannot be read. */
  evidenceStatus: EvidenceStatus;
  analysisMethod: AnalysisMethod | null;
  analysisNote: string | null;
}

export type EvidenceStatus = "full" | "provider_truncated" | "unparseable" | "missing";
export type AnalysisMethod = "llm" | "demo" | "name_match" | "failed";

interface RunRow {
  id: string;
  business_id: string;
  question_set_id: string;
  question_set_version: number;
  platforms: string;
  location_context: string;
  data_mode: DataMode;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  summary: string | null;
  analysis_note: string | null;
  fingerprint: string | null;
  created_at: string;
}

interface CheckRow {
  id: string;
  run_id: string;
  question_id: string;
  question_text: string;
  platform: PlatformId;
  model: string | null;
  location_context: string;
  status: CheckStatus;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  requested_at: string | null;
  completed_at: string | null;
  answer_text: string | null;
  usage: string | null;
  data_mode: DataMode;
  evidence_status: EvidenceStatus | null;
  analysis_method: AnalysisMethod | null;
  analysis_note: string | null;
}

function toRun(r: RunRow): Run {
  return {
    id: r.id,
    businessId: r.business_id,
    questionSetId: r.question_set_id,
    questionSetVersion: r.question_set_version,
    platforms: JSON.parse(r.platforms) as PlatformId[],
    locationContext: JSON.parse(r.location_context) as LocationContext,
    dataMode: r.data_mode,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    summary: r.summary ? (JSON.parse(r.summary) as RunSummary) : null,
    analysisNote: r.analysis_note,
    fingerprint: r.fingerprint ? (JSON.parse(r.fingerprint) as RunFingerprint) : null,
    createdAt: r.created_at,
  };
}

function toCheck(r: CheckRow): Check {
  return {
    id: r.id,
    runId: r.run_id,
    questionId: r.question_id,
    questionText: r.question_text,
    platform: r.platform,
    model: r.model,
    locationContext: JSON.parse(r.location_context) as LocationContext,
    status: r.status,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    attempts: r.attempts,
    requestedAt: r.requested_at,
    completedAt: r.completed_at,
    answerText: r.answer_text,
    usage: r.usage ? (JSON.parse(r.usage) as Record<string, unknown>) : null,
    dataMode: r.data_mode,
    evidenceStatus: r.evidence_status ?? "full",
    analysisMethod: r.analysis_method,
    analysisNote: r.analysis_note,
  };
}

const RUN_COLS =
  "id, business_id, question_set_id, question_set_version, platforms, location_context, data_mode, status, started_at, finished_at, summary, analysis_note, fingerprint, created_at";
const CHECK_COLS =
  "id, run_id, question_id, question_text, platform, model, location_context, status, error_code, error_message, attempts, requested_at, completed_at, answer_text, usage, data_mode, evidence_status, analysis_method, analysis_note";

/** Stored provider bodies larger than this keep only citations and hints (evidence_status = provider_truncated). */
export const RAW_EVIDENCE_CAP = 200_000;

export function createRun(
  db: Db,
  business: Business,
  questionSet: QuestionSet,
  platforms: PlatformId[],
  dataMode: DataMode,
  options: { audit?: boolean; fingerprint?: RunFingerprint } = {},
): Run {
  if (platforms.length === 0) throw new Error("At least one platform is required");
  const id = newId();
  const ts = nowIso();
  const location = locationOf(business);
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO runs (${RUN_COLS}, updated_at) VALUES (?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,?,?,?)`,
    ).run(
      id,
      business.id,
      questionSet.id,
      questionSet.version,
      JSON.stringify(platforms),
      JSON.stringify(location),
      dataMode,
      "queued",
      options.fingerprint ? JSON.stringify(options.fingerprint) : null,
      ts,
      ts,
    );
    const insert = db.prepare(
      `INSERT INTO checks (id, run_id, question_id, question_text, platform, location_context, status, attempts, data_mode, created_at, updated_at)
       VALUES (?,?,?,?,?,?,'queued',0,?,?,?)`,
    );
    for (const q of questionSet.questions) {
      for (const p of platforms) {
        insert.run(newId(), id, q.id, q.text, p, JSON.stringify(location), dataMode, ts, ts);
      }
    }
    enqueue(db, "run_checks", { runId: id });
    if (options.audit !== false) enqueue(db, "website_audit", { businessId: business.id, runId: id });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return getRun(db, id)!;
}

export function getRun(db: Db, id: string): Run | null {
  const row = db.prepare(`SELECT ${RUN_COLS} FROM runs WHERE id = ?`).get(id) as RunRow | undefined;
  return row ? toRun(row) : null;
}

export function listRuns(db: Db, businessId: string, limit = 50): Run[] {
  return (
    db.prepare(`SELECT ${RUN_COLS} FROM runs WHERE business_id = ? ORDER BY created_at DESC LIMIT ?`).all(businessId, limit) as unknown as RunRow[]
  ).map(toRun);
}

export function latestCompleteRun(db: Db, businessId: string): Run | null {
  const row = db
    .prepare(`SELECT ${RUN_COLS} FROM runs WHERE business_id = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1`)
    .get(businessId) as RunRow | undefined;
  return row ? toRun(row) : null;
}

export function latestRun(db: Db, businessId: string): Run | null {
  const row = db
    .prepare(`SELECT ${RUN_COLS} FROM runs WHERE business_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(businessId) as RunRow | undefined;
  return row ? toRun(row) : null;
}

export function countActiveRuns(db: Db, businessId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM runs WHERE business_id = ? AND status IN ('queued','running')")
    .get(businessId) as { c: number };
  return row.c;
}

/** Live runs created in the last 24 hours, for the abuse and cost cap. */
export function countLiveRunsLastDay(db: Db, businessId: string): number {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM runs WHERE business_id = ? AND data_mode = 'live' AND created_at >= ?")
    .get(businessId, since) as { c: number };
  return row.c;
}

export function setRunStatus(
  db: Db,
  id: string,
  status: RunStatus,
  extra: { summary?: RunSummary; analysisNote?: string | null } = {},
): void {
  const ts = nowIso();
  const startedAt = status === "running" ? ts : null;
  const finishedAt = status === "complete" || status === "failed" ? ts : null;
  // analysisNote: undefined keeps the stored note; null clears it; a string replaces it.
  const noteProvided = extra.analysisNote !== undefined;
  db.prepare(
    `UPDATE runs SET status = ?, started_at = COALESCE(started_at, ?), finished_at = COALESCE(?, finished_at),
       summary = COALESCE(?, summary), analysis_note = CASE WHEN ? = 1 THEN ? ELSE analysis_note END, updated_at = ? WHERE id = ?`,
  ).run(status, startedAt, finishedAt, extra.summary ? JSON.stringify(extra.summary) : null, noteProvided ? 1 : 0, extra.analysisNote ?? null, ts, id);
}

export function getChecksForRun(db: Db, runId: string): Check[] {
  return (db.prepare(`SELECT ${CHECK_COLS} FROM checks WHERE run_id = ? ORDER BY created_at ASC, id ASC`).all(runId) as unknown as CheckRow[]).map(toCheck);
}

export function getCheck(db: Db, id: string): Check | null {
  const row = db.prepare(`SELECT ${CHECK_COLS} FROM checks WHERE id = ?`).get(id) as CheckRow | undefined;
  return row ? toCheck(row) : null;
}

export function getCheckRaw(db: Db, id: string): string | null {
  const row = db.prepare("SELECT raw_response FROM checks WHERE id = ?").get(id) as { raw_response: string | null } | undefined;
  return row?.raw_response ?? null;
}

export function markCheckRunning(db: Db, id: string): void {
  const ts = nowIso();
  db.prepare("UPDATE checks SET status = 'running', requested_at = COALESCE(requested_at, ?), attempts = attempts + 1, updated_at = ? WHERE id = ?").run(ts, ts, id);
}

export function markCheckSuccess(
  db: Db,
  id: string,
  result: { model: string; answerText: string; raw: RawEvidenceEnvelope; usage?: Record<string, unknown> },
): EvidenceStatus {
  const ts = nowIso();
  let envelope = result.raw;
  let status: EvidenceStatus = "full";
  let json = JSON.stringify(envelope);
  if (json.length > RAW_EVIDENCE_CAP) {
    // Keep the small, structured parts (citations, hints) intact and drop the
    // provider body rather than truncating JSON into something unparseable.
    envelope = { ...envelope, provider: null, providerTruncated: true, providerBytes: json.length };
    status = "provider_truncated";
    json = JSON.stringify(envelope);
  }
  db.prepare(
    `UPDATE checks SET status = 'success', model = ?, answer_text = ?, raw_response = ?, usage = ?, evidence_status = ?, error_code = NULL, error_message = NULL, completed_at = ?, updated_at = ? WHERE id = ?`,
  ).run(result.model, result.answerText, json, result.usage ? JSON.stringify(result.usage) : null, status, ts, ts, id);
  return status;
}

/** Envelope stored in raw_response so analysis can be re-run offline. */
export interface RawEvidenceEnvelope {
  provider: unknown;
  citations: Array<{ url: string; title?: string }>;
  demoHints?: Array<{ name: string; recommended: boolean }>;
  providerTruncated?: boolean;
  providerBytes?: number;
}

export function setCheckAnalysis(db: Db, id: string, method: AnalysisMethod, note: string | null, evidenceStatus?: EvidenceStatus): void {
  db.prepare("UPDATE checks SET analysis_method = ?, analysis_note = ?, evidence_status = COALESCE(?, evidence_status), updated_at = ? WHERE id = ?").run(method, note, evidenceStatus ?? null, nowIso(), id);
}

export function markCheckFailed(db: Db, id: string, code: string, message: string): void {
  const ts = nowIso();
  db.prepare(
    "UPDATE checks SET status = 'failed', error_code = ?, error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?",
  ).run(code, message.slice(0, 500), ts, ts, id);
}

export function requeueCheck(db: Db, id: string): void {
  db.prepare("UPDATE checks SET status = 'queued', updated_at = ? WHERE id = ?").run(nowIso(), id);
}
