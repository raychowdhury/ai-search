import { z } from "zod";
import type { AskInput, PlatformAdapter, PlatformAnswer, PlatformCitation } from "./types";
import { PlatformError, PLATFORM_LABELS } from "./types";

/**
 * Google Gemini API, interactions endpoint with the google_search tool
 * (shape verified against https://ai.google.dev/gemini-api/docs/google-search on 2026-09-21).
 * The tool has no location parameter, so location context is added to the
 * question text ("... near Springfield, Illinois, US"). Free tier: Gemini 2.5
 * models with grounding up to 500 requests/day; prompts may be used by Google
 * to improve its products on the free tier.
 */
const annotationSchema = z.object({ type: z.string(), url: z.string().optional(), title: z.string().optional() });
const contentSchema = z.object({ type: z.string(), text: z.string().optional(), annotations: z.array(annotationSchema).optional() });
const stepSchema = z.object({ type: z.string(), content: z.array(contentSchema).optional() });
export const geminiResponseSchema = z.object({
  model: z.string().optional(),
  steps: z.array(stepSchema).optional(),
  content: z.array(contentSchema).optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  usage_metadata: z.record(z.string(), z.unknown()).optional(),
});

export function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

/** Location goes into the question because the tool accepts no location parameter. */
export function localizedQuestion(input: AskInput): string {
  const loc = [input.location.city, input.location.region, input.location.country].filter(Boolean).join(", ");
  const q = input.question.trim();
  if (q.toLowerCase().includes(input.location.city.toLowerCase())) return q;
  return `${q} (I am in ${loc}.)`;
}

export function parseGeminiAnswer(json: unknown): { answerText: string; citations: PlatformCitation[]; model?: string; usage?: Record<string, unknown> } {
  const parsed = geminiResponseSchema.safeParse(json);
  if (!parsed.success) throw new PlatformError("provider_response_invalid", "Provider response did not match the documented shape", false);
  const blocks = [...(parsed.data.steps ?? []).filter((s) => s.type === "model_output").flatMap((s) => s.content ?? []), ...(parsed.data.content ?? [])];
  const parts: string[] = [];
  const citations: PlatformCitation[] = [];
  for (const c of blocks) {
    if (c.type === "text" && c.text) parts.push(c.text);
    for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) citations.push({ url: a.url, title: a.title });
  }
  return { answerText: parts.join("\n").trim(), citations, model: parsed.data.model, usage: parsed.data.usage ?? parsed.data.usage_metadata };
}

export const geminiAdapter: PlatformAdapter = {
  id: "gemini",
  label: PLATFORM_LABELS.gemini,
  dataMode: "live",
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  async ask(input: AskInput): Promise<PlatformAnswer> {
    const model = geminiModel();
    const body = { model, input: localizedQuestion(input), tools: [{ type: "google_search" }] };
    let res: Response;
    try {
      res = await fetch(process.env.GEMINI_API_URL ?? "https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: input.signal ?? AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new PlatformError("network_error", err instanceof Error ? err.message : String(err), true);
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new PlatformError("auth_failed", "Provider rejected the API key", false);
    if (res.status === 429) throw new PlatformError("rate_limited", "Provider rate limit (free tier is 500 grounded requests per day)", true);
    if (res.status >= 500) throw new PlatformError("provider_unavailable", `Provider error ${res.status}`, true);
    if (!res.ok) throw new PlatformError("bad_request", `Provider error ${res.status}: ${text.slice(0, 200)}`, false);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new PlatformError("provider_response_invalid", "Provider returned non-JSON", false);
    }
    const out = parseGeminiAnswer(json);
    if (!out.answerText) throw new PlatformError("empty_answer", "Provider returned no answer text", false);
    return { answerText: out.answerText, citations: out.citations, raw: json, model: out.model ?? model, usage: out.usage };
  },
};
