import type { PlatformAdapter, PlatformId } from "./types";
import { demoAdapter } from "./demo";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import { perplexityAdapter } from "./perplexity";
import { geminiAdapter } from "./gemini";

const ALL: PlatformAdapter[] = [anthropicAdapter, openaiAdapter, geminiAdapter, perplexityAdapter, demoAdapter];

export function getAdapter(id: PlatformId): PlatformAdapter {
  const a = ALL.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown platform: ${id}`);
  return a;
}

/** Live adapters with credentials present. Never includes the demo adapter. */
export function configuredLiveAdapters(): PlatformAdapter[] {
  return ALL.filter((a) => a.dataMode === "live" && a.isConfigured());
}

export function allAdapters(): PlatformAdapter[] {
  return ALL;
}

/** Health-style summary: names only, never key values. */
export function adapterStatus(): Array<{ id: PlatformId; label: string; dataMode: "live" | "demo"; configured: boolean }> {
  return ALL.map((a) => ({ id: a.id, label: a.label, dataMode: a.dataMode, configured: a.isConfigured() }));
}
