/** Abuse and cost cap: live runs per business per rolling day. Sample runs are not capped. */
export const LIVE_RUNS_PER_DAY = Number(process.env.LIVE_RUNS_PER_DAY ?? 10);
