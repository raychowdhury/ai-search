import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { Stance } from "./names";

export interface MentionRecord {
  id: string;
  checkId: string;
  name: string;
  normalizedName: string;
  isOwner: boolean;
  /** Convenience view: stance === "positive". */
  isRecommended: boolean;
  stance: Stance;
  evidenceText: string;
  evidenceStart: number;
  evidenceEnd: number;
  extractionMethod: "name_match" | "llm" | "demo";
}

export interface CitationRecord {
  id: string;
  checkId: string;
  url: string;
  domain: string;
  title: string | null;
  isOwnerDomain: boolean;
  position: number;
}

export function replaceMentions(db: Db, checkId: string, mentions: Omit<MentionRecord, "id" | "checkId" | "isRecommended">[]): void {
  db.prepare("DELETE FROM mentions WHERE check_id = ?").run(checkId);
  const insert = db.prepare(
    `INSERT INTO mentions (id, check_id, name, normalized_name, is_owner, is_recommended, stance, evidence_text, evidence_start, evidence_end, extraction_method, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const ts = nowIso();
  for (const m of mentions) {
    insert.run(newId(), checkId, m.name, m.normalizedName, m.isOwner ? 1 : 0, m.stance === "positive" ? 1 : 0, m.stance, m.evidenceText, m.evidenceStart, m.evidenceEnd, m.extractionMethod, ts);
  }
}

export function replaceCitations(db: Db, checkId: string, citations: Omit<CitationRecord, "id" | "checkId">[]): void {
  db.prepare("DELETE FROM citations WHERE check_id = ?").run(checkId);
  const insert = db.prepare(
    "INSERT INTO citations (id, check_id, url, domain, title, is_owner_domain, position, created_at) VALUES (?,?,?,?,?,?,?,?)",
  );
  const ts = nowIso();
  for (const c of citations) {
    insert.run(newId(), checkId, c.url, c.domain, c.title, c.isOwnerDomain ? 1 : 0, c.position, ts);
  }
}

interface MentionRow {
  id: string; check_id: string; name: string; normalized_name: string; is_owner: number; is_recommended: number; stance: Stance;
  evidence_text: string; evidence_start: number; evidence_end: number; extraction_method: MentionRecord["extractionMethod"];
}
interface CitationRow {
  id: string; check_id: string; url: string; domain: string; title: string | null; is_owner_domain: number; position: number;
}

function toMention(r: MentionRow): MentionRecord {
  return {
    id: r.id, checkId: r.check_id, name: r.name, normalizedName: r.normalized_name, isOwner: r.is_owner === 1,
    isRecommended: r.stance === "positive", stance: r.stance ?? (r.is_recommended === 1 ? "positive" : "unknown"),
    evidenceText: r.evidence_text, evidenceStart: r.evidence_start, evidenceEnd: r.evidence_end, extractionMethod: r.extraction_method,
  };
}

export function mentionsForRun(db: Db, runId: string): MentionRecord[] {
  const rows = db
    .prepare("SELECT m.* FROM mentions m JOIN checks c ON c.id = m.check_id WHERE c.run_id = ? ORDER BY m.evidence_start")
    .all(runId) as unknown as MentionRow[];
  return rows.map(toMention);
}

export function citationsForRun(db: Db, runId: string): CitationRecord[] {
  const rows = db
    .prepare("SELECT ci.* FROM citations ci JOIN checks c ON c.id = ci.check_id WHERE c.run_id = ? ORDER BY ci.position")
    .all(runId) as unknown as CitationRow[];
  return rows.map((r) => ({
    id: r.id, checkId: r.check_id, url: r.url, domain: r.domain, title: r.title, isOwnerDomain: r.is_owner_domain === 1, position: r.position,
  }));
}

export function getCitation(db: Db, id: string): CitationRecord | null {
  const r = db.prepare("SELECT * FROM citations WHERE id = ?").get(id) as unknown as CitationRow | undefined;
  return r ? { id: r.id, checkId: r.check_id, url: r.url, domain: r.domain, title: r.title, isOwnerDomain: r.is_owner_domain === 1, position: r.position } : null;
}
