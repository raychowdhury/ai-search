import type { Extractor } from "./extract";
import { claudeExtractor, isClaudeExtractorConfigured } from "./claudeExtractor";
import { openaiExtractor, isOpenAiExtractorConfigured, geminiExtractor, isGeminiExtractorConfigured } from "./jsonExtractors";

export type ExtractorChoice = { name: "anthropic" | "openai" | "gemini"; extractor: Extractor; model: string } | null;

/** Preference: Claude (structured outputs), then OpenAI, then Gemini. Recorded in the run fingerprint. */
export function selectExtractor(): ExtractorChoice {
  const forced = process.env.EXTRACTOR;
  const options: Array<ExtractorChoice> = [
    isClaudeExtractorConfigured() ? { name: "anthropic", extractor: claudeExtractor, model: process.env.ANALYSIS_MODEL ?? "claude-opus-5" } : null,
    isOpenAiExtractorConfigured() ? { name: "openai", extractor: openaiExtractor, model: process.env.OPENAI_EXTRACTION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini" } : null,
    isGeminiExtractorConfigured() ? { name: "gemini", extractor: geminiExtractor, model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash" } : null,
  ];
  if (forced) return options.find((o) => o?.name === forced) ?? null;
  return options.find(Boolean) ?? null;
}

export function isExtractorConfigured(): boolean {
  return selectExtractor() !== null;
}
