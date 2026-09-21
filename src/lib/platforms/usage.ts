import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { PlatformId } from "./types";

export type CallKind = "answer" | "extraction";

/** Records one outbound provider call, before or after it is made (both count toward the cap). */
export function recordProviderCall(db: Db, provider: PlatformId, kind: CallKind): void {
  db.prepare("INSERT INTO provider_calls (id, provider, kind, at) VALUES (?,?,?,?)").run(newId(), provider, kind, nowIso());
}

/** First instant of the current UTC calendar month. */
export function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function callsThisMonth(db: Db, provider: PlatformId, now = new Date()): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM provider_calls WHERE provider = ? AND at >= ?").get(provider, monthStart(now)) as { c: number };
  return row.c;
}

/** Monthly request cap per provider. 0 means unlimited. Gemini defaults to 5,000 (the free grounding allowance on a billed project). */
export function monthlyCap(provider: PlatformId): number {
  const raw = process.env[`MONTHLY_REQUEST_CAP_${provider.toUpperCase()}`];
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && String(n) === raw.trim()) return n;
  }
  return provider === "gemini" ? 5000 : 0;
}

export interface CapStatus {
  provider: PlatformId;
  used: number;
  cap: number;
  remaining: number | null;
  reached: boolean;
  resetsAt: string;
}

export function capStatus(db: Db, provider: PlatformId, now = new Date()): CapStatus {
  const cap = monthlyCap(provider);
  const used = callsThisMonth(db, provider, now);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { provider, used, cap, remaining: cap ? Math.max(0, cap - used) : null, reached: cap > 0 && used >= cap, resetsAt: next };
}

/** True when `count` more calls would exceed the provider's monthly cap. */
export function wouldExceedCap(db: Db, provider: PlatformId, count: number, now = new Date()): boolean {
  const cap = monthlyCap(provider);
  if (!cap) return false;
  return callsThisMonth(db, provider, now) + count > cap;
}
