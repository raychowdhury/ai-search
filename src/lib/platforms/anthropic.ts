import Anthropic from "@anthropic-ai/sdk";
import type { AskInput, PlatformAdapter, PlatformAnswer, PlatformCitation } from "./types";
import { PlatformError, PLATFORM_LABELS } from "./types";

// Answers are collected through the Claude API's server-side web search tool.
// This is NOT the same as the Claude.ai consumer app; the product labels it as such.

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function anthropicAnswerModel(): string {
  return process.env.ANTHROPIC_ANSWER_MODEL ?? "claude-opus-5";
}

const RETRYABLE_SEARCH_ERRORS = new Set(["too_many_requests", "unavailable"]);

export const anthropicAdapter: PlatformAdapter = {
  id: "anthropic",
  label: PLATFORM_LABELS.anthropic,
  dataMode: "live",
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  async ask(input: AskInput): Promise<PlatformAnswer> {
    const model = anthropicAnswerModel();
    const location = input.location;
    const userLocation: Anthropic.Messages.UserLocation = {
      type: "approximate",
      city: location.city,
      region: location.region,
      country: location.country,
      ...(location.timezone ? { timezone: location.timezone } : {}),
    };
    // No system prompt on purpose: we want the provider's default answering
    // behaviour, not one steered toward or away from any business.
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: input.question }];
    let response: Anthropic.Beta.Messages.BetaMessage | null = null;
    let raw: unknown[] = [];

    for (let turn = 0; turn < 3; turn++) {
      let current: Anthropic.Beta.Messages.BetaMessage;
      try {
        current = await getClient().beta.messages.create(
          {
            model,
            max_tokens: 4096,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5, user_location: userLocation }],
            messages,
          },
          { signal: input.signal },
        );
      } catch (err) {
        throw mapSdkError(err);
      }
      raw = [...raw, current];
      response = current;
      if (current.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: current.content });
        continue;
      }
      break;
    }
    if (!response) throw new PlatformError("provider_unavailable", "No response from provider", true);
    if (response.stop_reason === "refusal") {
      throw new PlatformError("refusal", "The provider declined to answer this question", false);
    }

    const textParts: string[] = [];
    const citations: PlatformCitation[] = [];
    let searchError: string | null = null;
    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
        for (const c of block.citations ?? []) {
          if (c.type === "web_search_result_location") citations.push({ url: c.url, title: c.title ?? undefined });
        }
      } else if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) {
        searchError = block.content.error_code;
      }
    }
    const answerText = textParts.join("").trim();
    if (!answerText) {
      const code = searchError ?? "empty_answer";
      throw new PlatformError(code, `Provider returned no answer text (${code})`, RETRYABLE_SEARCH_ERRORS.has(code));
    }
    return {
      answerText,
      citations,
      raw: raw.length === 1 ? raw[0] : raw,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        web_search_requests: response.usage.server_tool_use?.web_search_requests ?? 0,
        ...(searchError ? { search_error: searchError } : {}),
      },
    };
  },
};

function mapSdkError(err: unknown): PlatformError {
  if (err instanceof Anthropic.RateLimitError) return new PlatformError("rate_limited", err.message, true);
  if (err instanceof Anthropic.AuthenticationError) return new PlatformError("auth_failed", "Provider rejected the API key", false);
  if (err instanceof Anthropic.BadRequestError) return new PlatformError("bad_request", err.message, false);
  if (err instanceof Anthropic.APIConnectionError) return new PlatformError("network_error", err.message, true);
  if (err instanceof Anthropic.APIError) return new PlatformError("provider_unavailable", err.message, (err.status ?? 500) >= 500);
  if (err instanceof Error && err.name === "AbortError") return new PlatformError("timeout", "Request timed out", true);
  return new PlatformError("unknown_error", err instanceof Error ? err.message : String(err), false);
}
