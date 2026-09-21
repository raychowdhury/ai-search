/**
 * Runs one live question through every configured live adapter, prints the
 * result, and persists it as evidence under data/live-smoke-<timestamp>.json.
 * Requires at least one provider key. Costs real API usage (a few cents).
 * Usage: pnpm live:smoke "Who is a good dentist in Springfield, Illinois?"
 */
import fs from "node:fs";
import path from "node:path";
import { configuredLiveAdapters } from "@/lib/platforms/registry";

const question = process.argv[2] ?? "Who is a good dentist in Springfield, Illinois?";
const location = { city: "Springfield", region: "Illinois", country: "US", timezone: "America/Chicago" };
const adapters = configuredLiveAdapters();
if (adapters.length === 0) {
  console.error("No live adapters configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or PERPLEXITY_API_KEY.");
  process.exit(1);
}
const results: Record<string, unknown>[] = [];
for (const adapter of adapters) {
  console.log(`\n=== ${adapter.label} ===`);
  const startedAt = new Date().toISOString();
  try {
    const answer = await adapter.ask({ question, location });
    console.log(`model: ${answer.model}`);
    console.log(answer.answerText);
    console.log("citations:", answer.citations);
    console.log("usage:", answer.usage);
    results.push({ platform: adapter.id, startedAt, ok: true, model: answer.model, answerText: answer.answerText, citations: answer.citations, usage: answer.usage, requestedLocation: location, raw: answer.raw });
  } catch (err) {
    console.error("FAILED:", err);
    results.push({ platform: adapter.id, startedAt, ok: false, error: err instanceof Error ? { name: err.name, message: err.message, ...(err as { code?: string }) } : String(err), requestedLocation: location });
  }
}
const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `live-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify({ question, location, results }, null, 2));
console.log(`\nSaved evidence to ${file}`);
