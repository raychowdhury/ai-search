import type { PlatformId } from "@/lib/platforms/types";

/**
 * Per-check API cost estimates. OpenAI figures come from a measured live run on
 * 2026-09-21 (gpt-5.4-mini: ~8.5k input, ~360 output tokens, one search per
 * question) priced at list rates; the others are list-price estimates from
 * docs/ARCHITECTURE.md. Real usage is recorded per check.
 */
export function perCheckEstimateUsd(platform: PlatformId): number {
  switch (platform) {
    case "anthropic": {
      const model = (process.env.ANTHROPIC_ANSWER_MODEL ?? "claude-opus-5").toLowerCase();
      return model.includes("sonnet") || model.includes("haiku") ? 0.05 : 0.1;
    }
    case "openai": {
      const model = (process.env.OPENAI_MODEL ?? "gpt-5.4-mini").toLowerCase();
      if (model.startsWith("gpt-5.5")) return 0.12; // $5/$30 per MTok, ~17k input measured
      if (model.startsWith("gpt-5.4-mini") || model.startsWith("gpt-5-mini") || model.includes("nano")) return 0.02;
      return 0.06; // gpt-5.4 and similar mid-tier
    }
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
