import type { PlatformId } from "@/lib/platforms/types";
import type { RunFingerprint } from "./runs";
import { EXTRACTION_VERSION } from "@/lib/analyze/extract";

export const PROMPT_TEMPLATE_VERSION = "v1";

function configuredModel(id: PlatformId): string {
  switch (id) {
    case "anthropic":
      return process.env.ANTHROPIC_ANSWER_MODEL ?? "claude-opus-5";
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-5-mini";
    case "perplexity":
      return process.env.PERPLEXITY_MODEL ?? "sonar";
    case "demo":
      return "demo-template-v1";
  }
}

/** Records how a run measures, so later runs compare only when the setup matches. */
export function buildFingerprint(platforms: PlatformId[], dataMode: "live" | "demo", extractorConfigured: boolean): RunFingerprint {
  const models: Record<string, string> = {};
  for (const p of [...platforms].sort()) models[p] = configuredModel(p);
  return {
    collection: dataMode === "demo" ? "demo" : "api",
    models,
    extractionModel: dataMode === "demo" ? "demo-hints" : extractorConfigured ? (process.env.ANALYSIS_MODEL ?? "claude-opus-5") : null,
    extractionVersion: EXTRACTION_VERSION,
    promptTemplate: PROMPT_TEMPLATE_VERSION,
    repetition: 1,
    language: "en",
  };
}
