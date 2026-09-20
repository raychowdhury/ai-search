import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { extractedBusinessSchema, EXTRACTION_SYSTEM_PROMPT, type Extractor } from "./extract";

export function analysisModel(): string {
  return process.env.ANALYSIS_MODEL ?? "claude-opus-5";
}

export function isClaudeExtractorConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Structured-output extraction. Callers must run verifyExtraction on the result. */
export const claudeExtractor: Extractor = async (answer) => {
  const response = await getClient().messages.parse({
    model: analysisModel(),
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `<answer>\n${answer}\n</answer>` }],
    output_config: { format: zodOutputFormat(extractedBusinessSchema) },
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return { businesses: [] };
  }
  return response.parsed_output;
};
