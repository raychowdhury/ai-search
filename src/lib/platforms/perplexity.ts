import { z } from "zod";
import type { AskInput, PlatformAdapter, PlatformAnswer } from "./types";
import { PlatformError, PLATFORM_LABELS } from "./types";

// Perplexity Sonar API (documented shape verified 2026-09-19; not yet exercised live).
const responseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  citations: z.array(z.string()).optional(),
  search_results: z.array(z.object({ title: z.string().optional(), url: z.string() })).optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
});

export const perplexityAdapter: PlatformAdapter = {
  id: "perplexity",
  label: PLATFORM_LABELS.perplexity,
  dataMode: "live",
  isConfigured: () => Boolean(process.env.PERPLEXITY_API_KEY),
  async ask(input: AskInput): Promise<PlatformAnswer> {
    const url = process.env.PERPLEXITY_API_URL ?? "https://api.perplexity.ai/v1/sonar";
    const model = process.env.PERPLEXITY_MODEL ?? "sonar";
    const body = {
      model,
      messages: [{ role: "user", content: input.question }],
      web_search_options: {
        search_context_size: process.env.PERPLEXITY_CONTEXT_SIZE ?? "low",
        user_location: { country: input.location.country, city: input.location.city, region: input.location.region },
      },
    };
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: input.signal ?? AbortSignal.timeout(90_000),
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
    const titles = new Map((parsed.data.search_results ?? []).map((r) => [r.url, r.title]));
    const citations = (parsed.data.citations ?? []).map((u) => ({ url: u, title: titles.get(u) }));
    return {
      answerText: parsed.data.choices[0].message.content.trim(),
      citations,
      raw: json,
      model: parsed.data.model ?? model,
      usage: parsed.data.usage,
    };
  },
};
