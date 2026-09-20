/**
 * Runs one live question through every configured live adapter and prints the
 * answer text and citations. Requires at least one provider key in the environment.
 * Usage: pnpm dlx tsx scripts/live-smoke.mts "Who is a good dentist in Springfield, Illinois?"
 */
import { configuredLiveAdapters } from "@/lib/platforms/registry";

const question = process.argv[2] ?? "Who is a good dentist in Springfield, Illinois?";
const adapters = configuredLiveAdapters();
if (adapters.length === 0) {
  console.error("No live adapters configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or PERPLEXITY_API_KEY.");
  process.exit(1);
}
for (const adapter of adapters) {
  console.log(`\n=== ${adapter.label} ===`);
  try {
    const answer = await adapter.ask({
      question,
      location: { city: "Springfield", region: "Illinois", country: "US", timezone: "America/Chicago" },
      business: { name: "", category: "", city: "Springfield", region: "Illinois", websiteDomain: "", services: [] },
    });
    console.log(`model: ${answer.model}`);
    console.log(answer.answerText);
    console.log("citations:", answer.citations);
    console.log("usage:", answer.usage);
  } catch (err) {
    console.error("FAILED:", err);
  }
}
