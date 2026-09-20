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

/** What the demo adapter needs to template sample answers. Live adapters must ignore it. */
export interface BusinessSnapshot {
  name: string;
  category: string;
  city: string;
  region: string;
  websiteDomain: string;
  services: string[];
}

export interface AskInput {
  question: string;
  location: LocationContext;
  business: BusinessSnapshot;
  signal?: AbortSignal;
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
  ask(input: AskInput): Promise<PlatformAnswer>;
}

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  demo: "Sample platform (not a real AI service)",
  anthropic: "Claude (API with web search)",
  openai: "ChatGPT models (OpenAI API with web search)",
  perplexity: "Perplexity (Sonar API)",
};
