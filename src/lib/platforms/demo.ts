import type { AskInput, DemoContext, PlatformAdapter, PlatformAnswer } from "./types";
import { PlatformError, PLATFORM_LABELS } from "./types";

// Deterministic sample answers. They are templated from the owner's details so
// the whole workflow can be exercised, but they are NOT real AI answers.
// Every source uses the reserved .example TLD so nothing points at a real site.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function demoCompetitors(business: DemoContext): string[] {
  const cat = titleCase(business.category);
  return [`${titleCase(business.city)} ${cat} Center`, `Northside ${cat} Co.`, `Bright ${cat} Group`];
}

export function buildDemoAnswer(input: AskInput, business: DemoContext): PlatformAnswer {
  const { question } = input;
  const scenario = hash(question) % 10;
  const [c1, c2, c3] = demoCompetitors(business);
  const city = business.city;
  const cat = business.category.toLowerCase();
  const svc = business.services[0] ?? cat;
  const dir = `https://sample-directory.example/${slug(city)}/${slug(cat)}`;
  const reviews = `https://sample-reviews.example/${slug(city)}/${slug(cat)}`;
  const owner = `https://${business.websiteDomain}/`;

  if (scenario === 0) {
    throw new PlatformError("demo_simulated_outage", "Simulated platform outage (sample data)", false);
  }

  if (scenario <= 3) {
    return {
      model: "demo-template-v1",
      answerText:
        `Here are a few well-reviewed options for ${cat} services in ${city}:\n\n` +
        `1. ${business.name} - frequently recommended for ${svc}, with consistently positive reviews and clear pricing on its website.\n` +
        `2. ${c1} - a larger practice with extended weekend hours.\n` +
        `3. ${c2} - praised for friendly staff and quick appointments.\n\n` +
        `I'd suggest starting with ${business.name} if you want ${svc}, and ${c1} if weekend availability matters most.`,
      citations: [
        { url: owner, title: `${business.name} - ${titleCase(cat)} in ${city}` },
        { url: dir, title: `Top ${titleCase(cat)} in ${city} (sample directory)` },
        { url: reviews, title: `${titleCase(cat)} reviews in ${city} (sample reviews)` },
      ],
      demoHints: [
        { name: business.name, recommended: true },
        { name: c1, recommended: true },
        { name: c2, recommended: true },
      ],
      raw: { demo: true, scenario: "owner_recommended" },
    };
  }

  if (scenario <= 6) {
    return {
      model: "demo-template-v1",
      answerText:
        `Based on reviews and local listings, the most recommended ${cat} providers in ${city} are:\n\n` +
        `- ${c1}: highest number of recent reviews and a detailed services page.\n` +
        `- ${c3}: strong ratings for ${svc}.\n` +
        `- ${c2}: good value and easy online booking.\n\n` +
        `Any of these would be a solid choice; ${c1} is the most frequently mentioned across sources.`,
      citations: [
        { url: dir, title: `Top ${titleCase(cat)} in ${city} (sample directory)` },
        { url: `https://sample-listings.example/${slug(c1)}`, title: `${c1} (sample listing)` },
        { url: reviews, title: `${titleCase(cat)} reviews in ${city} (sample reviews)` },
      ],
      demoHints: [
        { name: c1, recommended: true },
        { name: c3, recommended: true },
        { name: c2, recommended: true },
      ],
      raw: { demo: true, scenario: "owner_absent" },
    };
  }

  if (scenario <= 8) {
    return {
      model: "demo-template-v1",
      answerText:
        `For ${svc} in ${city}, ${c3} is the option most sources point to, mainly because of its detailed service descriptions and published hours. ` +
        `${business.name} also offers ${svc}, though I found less information about its hours and pricing online. ` +
        `If you need same-day help, call ahead to confirm availability.`,
      citations: [
        { url: `https://sample-listings.example/${slug(c3)}`, title: `${c3} (sample listing)` },
        { url: reviews, title: `${titleCase(cat)} reviews in ${city} (sample reviews)` },
      ],
      demoHints: [
        { name: c3, recommended: true },
        { name: business.name, recommended: false },
      ],
      raw: { demo: true, scenario: "owner_mentioned_not_recommended" },
    };
  }

  return {
    model: "demo-template-v1",
    answerText:
      `Prices for ${svc} in ${city} vary widely depending on the provider and the scope of work. ` +
      `Most local listings suggest getting two or three quotes and checking recent reviews before booking. ` +
      `Look for a ${cat} that lists its service area, hours, and contact details clearly.`,
    citations: [{ url: `https://sample-guides.example/${slug(svc)}-cost`, title: `${titleCase(svc)} cost guide (sample)` }],
    demoHints: [],
    raw: { demo: true, scenario: "no_businesses_named" },
  };
}

export const demoAdapter: PlatformAdapter = {
  id: "demo",
  label: PLATFORM_LABELS.demo,
  dataMode: "demo",
  isConfigured: () => true,
  async ask(input, demo) {
    if (!demo) throw new PlatformError("demo_context_missing", "The sample adapter needs business details to template an answer", false);
    await new Promise((r) => setTimeout(r, 150));
    return buildDemoAnswer(input, demo);
  },
};
