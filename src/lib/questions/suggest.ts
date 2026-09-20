import type { BusinessInput } from "@/lib/business/schema";

export interface Question {
  id: string;
  text: string;
  source: "suggested" | "owner";
}

type Ctx = Pick<BusinessInput, "category" | "city" | "region" | "services" | "serviceArea">;

function lower(s: string): string {
  return s.trim().toLowerCase();
}

function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

/**
 * Builds customer-style questions from onboarding input.
 * Deterministic and template-based so owners always get at least 8.
 */
export function suggestQuestions(ctx: Ctx, max = 12): string[] {
  const cat = lower(ctx.category);
  const city = ctx.city.trim();
  const region = ctx.region.trim();
  const area = ctx.serviceArea.trim();
  const services = ctx.services.map(lower).filter(Boolean);
  const a = article(cat);

  const core = [
    `Who is the best ${cat} in ${city}?`,
    `Can you recommend ${a} ${cat} near ${city}, ${region}?`,
    `Which ${cat} in ${city} has the best reviews?`,
    `What are the top ${cat} options in ${city}?`,
    `Is there ${a} ${cat} in ${city} that is open on weekends?`,
    `Who is a reliable ${cat} that serves ${area}?`,
  ];

  const perService = services.slice(0, 4).flatMap((svc) => [
    `I need ${svc} in ${city}. Who should I call?`,
    `Which ${cat} in ${city} offers ${svc}?`,
  ]);

  const first = services[0];
  const extra = [
    first ? `Who does same-day ${first} in ${city}?` : `Who offers same-day service for ${cat} needs in ${city}?`,
    first
      ? `How much does ${first} cost in ${city}, and who is recommended?`
      : `How much does ${a} ${cat} cost in ${city}, and who is recommended?`,
    `Compare the most recommended ${cat} businesses in ${city}.`,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of [...core, ...perService, ...extra]) {
    const key = q.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
    if (out.length >= max) break;
  }
  return out;
}
