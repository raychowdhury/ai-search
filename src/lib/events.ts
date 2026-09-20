import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";

/** Pilot instrumentation events. Business-level only; no customer details. */
export type EventType =
  | "onboarding_completed"
  | "facts_confirmed"
  | "run_started"
  | "report_viewed"
  | "action_started"
  | "action_done_reported"
  | "action_verified"
  | "verification_failed"
  | "recurrence_detected";

export function logEvent(db: Db, businessId: string, type: EventType, meta: Record<string, unknown> = {}): void {
  db.prepare("INSERT INTO events (id, business_id, type, meta, at) VALUES (?,?,?,?,?)").run(newId(), businessId, type, JSON.stringify(meta), nowIso());
}

export function listEvents(db: Db, businessId: string, limit = 200): Array<{ type: EventType; at: string; meta: Record<string, unknown> }> {
  return (db.prepare("SELECT type, at, meta FROM events WHERE business_id = ? ORDER BY at DESC LIMIT ?").all(businessId, limit) as unknown as Array<{ type: EventType; at: string; meta: string }>).map((r) => ({
    type: r.type,
    at: r.at,
    meta: JSON.parse(r.meta) as Record<string, unknown>,
  }));
}
