import { extractedBusinessSchema, EXTRACTION_SYSTEM_PROMPT, type Extractor, type ExtractedBusinesses } from "./extract";

/**
 * Competitor extractors for providers without a verified structured-output
 * helper in this codebase. They ask for JSON, then parse strictly; anything that
 * does not validate throws, which the analysis step records as "failed" for that
 * answer (never as "no competitors"). The verbatim-excerpt guard in
 * verifyExtraction applies afterwards regardless of the model.
 */
const JSON_INSTRUCTION =
  '\n\nRespond with JSON only, no prose, no code fences, matching exactly: {"businesses":[{"name":"...","stance":"positive|negative|neutral|unknown","evidence":"..."}]}';

export function parseExtractionJson(text: string): ExtractedBusinesses {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("extractor returned no JSON object");
  const parsed = extractedBusinessSchema.safeParse(JSON.parse(trimmed.slice(start, end + 1)));
  if (!parsed.success) throw new Error("extractor JSON did not match the schema");
  return parsed.data;
}

export function isOpenAiExtractorConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiExtractorModel(): string {
  return process.env.OPENAI_EXTRACTION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
}

/** OpenAI Responses API without tools; verified live 2026-09-21. */
export const openaiExtractor: Extractor = async (answer) => {
  const res = await fetch(process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: openaiExtractorModel(), instructions: EXTRACTION_SYSTEM_PROMPT + JSON_INSTRUCTION, input: `<answer>\n${answer}\n</answer>` }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`openai extractor ${res.status}`);
  const json = (await res.json()) as { output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
  const text = (json.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("\n");
  return parseExtractionJson(text);
};

export function isGeminiExtractorConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Gemini interactions endpoint without tools. Written from the documented shape; not exercised live yet. */
export const geminiExtractor: Extractor = async (answer) => {
  const res = await fetch(process.env.GEMINI_API_URL ?? "https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.GEMINI_MODEL ?? "gemini-3.6-flash", input: `${EXTRACTION_SYSTEM_PROMPT}${JSON_INSTRUCTION}\n\n<answer>\n${answer}\n</answer>` }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`gemini extractor ${res.status}`);
  const json = (await res.json()) as { steps?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>; content?: Array<{ type: string; text?: string }> };
  const blocks = [...(json.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []), ...(json.content ?? [])];
  return parseExtractionJson(blocks.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
};
