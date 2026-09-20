import type { BusinessInput } from "@/lib/business/schema";

export type QuestionIntent = "discovery" | "service" | "availability" | "price" | "comparison" | "other";

export interface Question {
  id: string;
  text: string;
  /** template = suggested by the product; owner = written or edited by the owner. Never search-volume data. */
  source: "suggested" | "owner";
  intent?: QuestionIntent;
}

type Ctx = Pick<BusinessInput, "category" | "city" | "region" | "services" | "serviceArea"> & Partial<Pick<BusinessInput, "hours" | "priorityServices">>;

function lower(s: string): string {
  return s.trim().toLowerCase();
}

function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

export interface Suggested {
  text: string;
  intent: QuestionIntent;
}

/**
 * Builds customer-style discovery questions from onboarding input. Template-based
 * hypotheses about what customers ask, not search-volume data. Availability
 * questions (weekends, same-day) are only suggested when the confirmed facts
 * support them, so the product does not measure demand for things the business
 * does not offer.
 */
export function suggestQuestionsDetailed(ctx: Ctx, max = 12): Suggested[] {
  const cat = lower(ctx.category);
  const city = ctx.city.trim();
  const region = ctx.region.trim();
  const area = ctx.serviceArea.trim();
  const priority = (ctx.priorityServices ?? []).map(lower).filter(Boolean);
  const rest = ctx.services.map(lower).filter((s) => s && !priority.includes(s));
  const services = [...priority, ...rest];
  const a = article(cat);
  const hours = lower(ctx.hours ?? "");
  const weekendConfirmed = /\b(sat|sun|weekend|7 days|every day|daily)\b/.test(hours);
  const sameDayOffered = services.some((s) => /same[- ]day|emergency|urgent|24[/ -]?7|24 hour/.test(s));

  const core: Suggested[] = [
    { text: `Who is the best ${cat} in ${city}?`, intent: "discovery" },
    { text: `Can you recommend ${a} ${cat} near ${city}, ${region}?`, intent: "discovery" },
    { text: `Which ${cat} in ${city} has the best reviews?`, intent: "discovery" },
    { text: `What are the top ${cat} options in ${city}?`, intent: "discovery" },
    { text: `Who is a reliable ${cat} that serves ${area}?`, intent: "discovery" },
  ];
  if (weekendConfirmed) core.push({ text: `Is there ${a} ${cat} in ${city} that is open on weekends?`, intent: "availability" });

  const perService: Suggested[] = services.slice(0, 4).flatMap((svc) => [
    { text: `I need ${svc} in ${city}. Who should I call?`, intent: "service" as const },
    { text: `Which ${cat} in ${city} offers ${svc}?`, intent: "service" as const },
  ]);

  const first = services[0];
  const extra: Suggested[] = [];
  if (sameDayOffered && first) extra.push({ text: `Who does same-day ${first} in ${city}?`, intent: "availability" });
  extra.push(
    first
      ? { text: `How much does ${first} cost in ${city}, and who is recommended?`, intent: "price" }
      : { text: `How much does ${a} ${cat} cost in ${city}, and who is recommended?`, intent: "price" },
  );
  extra.push({ text: `Compare the most recommended ${cat} businesses in ${city}.`, intent: "comparison" });

  const seen = new Set<string>();
  const out: Suggested[] = [];
  // Interleave so priority-service questions and the price/comparison questions are not crowded out.
  const ordered = [...core.slice(0, 3), ...perService.slice(0, 4), ...extra, ...core.slice(3), ...perService.slice(4)];
  for (const q of ordered) {
    const key = q.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
    if (out.length >= max) break;
  }
  return out;
}

export function suggestQuestions(ctx: Ctx, max = 12): string[] {
  return suggestQuestionsDetailed(ctx, max).map((q) => q.text);
}
