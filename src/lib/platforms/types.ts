import type { LocationContext } from "@/lib/business/schema";

export type PlatformId = "demo" | "anthropic" | "openai" | "perplexity";
export type DataMode = "live" | "demo";

export interface PlatformCitation {
  url: string;
  title?: string;
}

/** Hints the demo adapter attaches so demo analysis can mark competitors without an LLM. */
export interface DemoEntityHint {
  name: string;
  recommended: boolean;
}

export interface PlatformAnswer {
  answerText: string;
  citations: PlatformCitation[];
  raw: unknown;
  model: string;
  usage?: Record<string, unknown>;
  demoHints?: DemoEntityHint[];
}

/**
 * Everything a live adapter may send outbound: the question and location context.
 * The business name, website, and services are deliberately not part of this type,
 * so a live adapter cannot include them without a type error.
 */
export interface AskInput {
  question: string;
  location: LocationContext;
  signal?: AbortSignal;
}

/** What the sample adapter needs to template answers. Only the demo adapter receives it. */
export interface DemoContext {
  name: string;
  category: string;
  city: string;
  region: string;
  websiteDomain: string;
  services: string[];
}

export class PlatformError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface PlatformAdapter {
  id: PlatformId;
  /** Shown to owners, e.g. "Claude (API with web search)". */
  label: string;
  dataMode: DataMode;
  isConfigured(): boolean;
  /** Live adapters receive only `input`. The worker passes `demo` solely to the demo adapter. */
  ask(input: AskInput, demo?: DemoContext): Promise<PlatformAnswer>;
}

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  demo: "Sample platform (not a real AI service)",
  anthropic: "Claude (API with web search)",
  openai: "ChatGPT models (OpenAI API with web search)",
  perplexity: "Perplexity (Sonar API)",
};
