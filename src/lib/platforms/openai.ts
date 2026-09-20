import { z } from "zod";
import type { AskInput, PlatformAdapter, PlatformAnswer, PlatformCitation } from "./types";
import { PlatformError, PLATFORM_LABELS } from "./types";

// OpenAI Responses API with the web_search tool (documented shape verified 2026-09-19; not yet exercised live).
const responseSchema = z.object({
  model: z.string().optional(),
  status: z.string().optional(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
            annotations: z
              .array(z.object({ type: z.string(), url: z.string().optional(), title: z.string().optional() }))
              .optional(),
          }),
        )
        .optional(),
    }),
  ),
  usage: z.record(z.string(), z.unknown()).optional(),
});

export const openaiAdapter: PlatformAdapter = {
  id: "openai",
  label: PLATFORM_LABELS.openai,
  dataMode: "live",
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),
  async ask(input: AskInput): Promise<PlatformAnswer> {
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const body = {
      model,
      input: input.question,
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            city: input.location.city,
            region: input.location.region,
            country: input.location.country,
            ...(input.location.timezone ? { timezone: input.location.timezone } : {}),
          },
        },
      ],
    };
    let res: Response;
    try {
      res = await fetch(process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: input.signal ?? AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new PlatformError("network_error", err instanceof Error ? err.message : String(err), true);
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new PlatformError("auth_failed", "Provider rejected the API key", false);
    if (res.status === 429) throw new PlatformError("rate_limited", "Provider rate limit", true);
    if (res.status >= 500) throw new PlatformError("provider_unavailable", `Provider error ${res.status}`, true);
    if (!res.ok) throw new PlatformError("bad_request", `Provider error ${res.status}: ${text.slice(0, 200)}`, false);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new PlatformError("provider_response_invalid", "Provider returned non-JSON", false);
    }
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new PlatformError("provider_response_invalid", "Provider response did not match the documented shape", false);
    const parts: string[] = [];
    const citations: PlatformCitation[] = [];
    for (const item of parsed.data.output) {
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if (c.type === "output_text" && c.text) parts.push(c.text);
        for (const a of c.annotations ?? []) {
          if (a.type === "url_citation" && a.url) citations.push({ url: a.url, title: a.title });
        }
      }
    }
    const answerText = parts.join("\n").trim();
    if (!answerText) throw new PlatformError("empty_answer", "Provider returned no answer text", false);
    return { answerText, citations, raw: json, model: parsed.data.model ?? model, usage: parsed.data.usage };
  },
};
