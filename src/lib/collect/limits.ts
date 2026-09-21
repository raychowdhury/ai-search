/**
 * Abuse and cost cap: live runs per business per rolling day. Sample runs are not
 * capped. A malformed or negative value falls back to the default instead of
 * disabling the cap (NaN comparisons would silently fail open).
 */
export const DEFAULT_LIVE_RUNS_PER_DAY = 10;

export function parseLiveRunsPerDay(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_LIVE_RUNS_PER_DAY;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || String(n) !== raw.trim()) return DEFAULT_LIVE_RUNS_PER_DAY;
  return n;
}

export const LIVE_RUNS_PER_DAY = parseLiveRunsPerDay(process.env.LIVE_RUNS_PER_DAY);
