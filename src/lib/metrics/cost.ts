import type { PlatformId } from "@/lib/platforms/types";

/**
 * Rough per-check API cost from list prices (see docs/ARCHITECTURE.md, section 5).
 * Shown to owners as "about $X in API usage"; real usage is recorded per check.
 */
export function perCheckEstimateUsd(platform: PlatformId): number {
  switch (platform) {
    case "anthropic": {
      const model = (process.env.ANTHROPIC_ANSWER_MODEL ?? "claude-opus-5").toLowerCase();
      return model.includes("sonnet") || model.includes("haiku") ? 0.05 : 0.1;
    }
    case "openai":
      return 0.035;
    case "perplexity":
      return 0.035;
    case "demo":
      return 0;
  }
}

export function estimateRunCostUsd(questionCount: number, platforms: PlatformId[]): number {
  return platforms.reduce((sum, p) => sum + perCheckEstimateUsd(p) * questionCount, 0);
}

export function formatUsd(n: number): string {
  if (n < 0.01) return "$0.01";
  return `$${n.toFixed(2)}`;
}
