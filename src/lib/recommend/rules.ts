import type { Business } from "@/lib/business/schema";
import type { RunMetrics } from "@/lib/metrics/compute";
import type { Finding } from "@/lib/audit/rules";
import type { PageStatus } from "@/lib/audit/run";

export type Effort = "low" | "medium" | "high";

export interface EvidenceRef {
  type: "check" | "finding" | "audit";
  id: string;
  excerpt: string;
}

export interface Recommendation {
  ruleId: string;
  title: string;
  why: string;
  evidence: EvidenceRef[];
  suggestedCopy: string | null;
  effort: Effort;
  score: number;
}

export interface AuditInput {
  id: string;
  status: "complete" | "failed_fetch" | "queued" | "running";
  pages: PageStatus[];
  findings: Array<Finding & { id: string }>;
}

export interface RecommendInput {
  business: Business;
  metrics: RunMetrics;
  audit: AuditInput | null;
  dataMode: "live" | "demo";
}

const EFFORT_ORDER: Record<Effort, number> = { low: 0, medium: 1, high: 2 };

/**
 * Produces evidence-backed improvement opportunities. Every recommendation cites
 * at least one stored check or audit finding. Nothing here claims causation.
 */
export function buildRecommendations(input: RecommendInput): Recommendation[] {
  const out: Recommendation[] = [];
  const { business, metrics, audit } = input;
  const findings = audit?.status === "complete" ? audit.findings : [];
  const f = (ruleId: string) => findings.find((x) => x.ruleId === ruleId);
  const sev = (ruleId: string): Finding["severity"] | null => f(ruleId)?.severity ?? null;
  const ref = (finding: Finding & { id: string }): EvidenceRef => ({ type: "finding", id: finding.id, excerpt: finding.title });
  const successful = metrics.successfulChecks;
  const ownerAbsentQuestions = metrics.questions.filter((q) => q.status === "success" && !q.ownerMentioned);
  const competitorRecommendedAnywhere = metrics.competitors.some((c) => c.recommended > 0);
  const checkRef = (checkId: string, excerpt: string): EvidenceRef => ({ type: "check", id: checkId, excerpt });

  // Website unreachable trumps everything: nothing else can be verified.
  if (audit && audit.status === "failed_fetch") {
    const first = audit.pages[0];
    out.push({
      ruleId: "website_unreachable",
      title: "Make sure your website loads for visitors and tools",
      why: `We could not read your website (${first?.error ?? "unknown reason"}). AI assistants that rely on web search cannot cite a site they cannot open.`,
      evidence: [{ type: "audit", id: audit.id, excerpt: `${first?.url ?? business.websiteUrl}: ${first?.error ?? "not reachable"}` }],
      suggestedCopy: null,
      effort: "high",
      score: 95,
    });
  }

  // Contact details
  const contactRules = ["contact.phone", "location.address", "location.hours", "contact.page"] as const;
  const contactMissing = contactRules.filter((r) => sev(r) === "missing");
  const contactWarn = contactRules.filter((r) => sev(r) === "warn");
  if (contactMissing.length || contactWarn.length) {
    const ev = [...contactMissing, ...contactWarn].map((r) => ref(f(r)!));
    out.push({
      ruleId: "contact_details",
      title: "Put your phone, address, and hours on every page",
      why: `Your website audit found ${contactMissing.length ? `missing: ${contactMissing.map(label).join(", ")}` : ""}${contactMissing.length && contactWarn.length ? "; " : ""}${contactWarn.length ? `needs attention: ${contactWarn.map(label).join(", ")}` : ""}. Assistants answer "who should I call" questions with the businesses whose details they can read.`,
      evidence: ev,
      suggestedCopy: contactBlock(business),
      effort: "low",
      score: contactMissing.length ? 78 + Math.min(10, contactMissing.length * 3) : 50,
    });
  }

  // Name and city on homepage
  const cityMissing = sev("location.city");
  const nameMissing = sev("technical.name");
  const titleSev = sev("technical.title");
  if (cityMissing === "missing" || cityMissing === "warn" || nameMissing === "missing" || titleSev === "missing" || titleSev === "warn") {
    const ev = [f("location.city"), f("technical.name"), f("technical.title")].filter((x): x is Finding & { id: string } => Boolean(x) && x!.severity !== "good").map(ref);
    out.push({
      ruleId: "name_city_on_homepage",
      title: `Say who you are and where you are on the homepage`,
      why: `The homepage should state "${business.name}" and "${business.city}" in the page title and a headline. ${cityMissing === "missing" ? `We did not find ${business.city} anywhere on the pages we checked.` : cityMissing === "warn" ? `${business.city} appears on an inner page but not the homepage.` : ""} ${nameMissing === "missing" ? "We also could not find your business name in the homepage text." : ""}`.trim(),
      evidence: ev,
      suggestedCopy: homepageCopy(business),
      effort: "low",
      score: cityMissing === "missing" || nameMissing === "missing" ? 82 : 60,
    });
  }

  // Services
  const servicesNamed = sev("services.named");
  const servicesPage = sev("services.page");
  if (servicesNamed === "missing" || servicesNamed === "warn" || servicesPage === "warn") {
    const missingList = f("services.named")?.detail.match(/could not find: ([^.]+)\./)?.[1] ?? f("services.named")?.detail.match(/page text: ([^.]+)\./)?.[1] ?? "";
    const missing = missingList ? missingList.split(",").map((s) => s.trim()).filter(Boolean) : business.services;
    const ev = [f("services.named"), f("services.page")].filter((x): x is Finding & { id: string } => Boolean(x) && x!.severity !== "good").map(ref);
    const serviceQuestionsAbsent = ownerAbsentQuestions.filter((q) => business.services.some((s) => q.questionText.toLowerCase().includes(s.toLowerCase())));
    for (const q of serviceQuestionsAbsent.slice(0, 2)) ev.push(checkRef(q.checkId, `Not mentioned for: "${q.questionText}"`));
    out.push({
      ruleId: "service_pages",
      title: "Describe each main service in plain words",
      why: `${servicesNamed === "missing" ? "None of your main services are named on your site." : servicesNamed === "warn" ? `Some services are not named on your site (${missing.join(", ")}).` : "There is no dedicated services page."} ${serviceQuestionsAbsent.length ? `In this check you were not mentioned for ${serviceQuestionsAbsent.length} service-specific question${serviceQuestionsAbsent.length === 1 ? "" : "s"}.` : ""}`.trim(),
      evidence: ev,
      suggestedCopy: servicesCopy(business, missing),
      effort: "medium",
      score: (servicesNamed === "missing" ? 74 : 62) + (serviceQuestionsAbsent.length ? 8 : 0),
    });
  }

  // Structured data
  const schemaSev = sev("technical.schema");
  if (schemaSev === "missing" || schemaSev === "warn") {
    out.push({
      ruleId: "local_business_schema",
      title: "Add structured business data to your site",
      why: `${schemaSev === "missing" ? "Your site has no LocalBusiness structured data." : "Your structured data is incomplete."} This is a small block of code that lists your name, address, phone, hours, and area in a standard format that search and AI tools read directly.${metrics.citationRate.denominator > 0 && metrics.citationRate.numerator === 0 ? ` Your website was not cited in any of the ${metrics.citationRate.denominator} successful answers in this check.` : ""}`,
      evidence: [ref(f("technical.schema")!)],
      suggestedCopy: jsonLdCopy(business),
      effort: "medium",
      score: (schemaSev === "missing" ? 66 : 48) + (metrics.citationRate.denominator > 0 && metrics.citationRate.numerator === 0 ? 10 : 0),
    });
  }

  // Sources the assistants cite that are not you
  if (successful > 0) {
    const citedElsewhere = metrics.topDomains.filter((d) => !d.isOwnerDomain && d.checks >= 2).slice(0, 4);
    if (citedElsewhere.length) {
      out.push({
        ruleId: "get_listed_on_cited_sources",
        title: "Make sure you are listed on the sites the assistants cite",
        why: `Across ${successful} successful answers, these sources were cited most often: ${citedElsewhere.map((d) => `${d.domain} (${d.checks} of ${successful})`).join(", ")}. Your own site was cited in ${metrics.citationRate.numerator} of ${successful}. Having a complete, accurate profile on the sources assistants already read is a practical way to be part of those answers.`,
        evidence: citedElsewhere.map((d) => ({ type: "audit" as const, id: `domain:${d.domain}`, excerpt: `${d.domain} cited in ${d.checks} of ${successful} answers` })),
        suggestedCopy: null,
        effort: "medium",
        score: Math.min(85, 58 + citedElsewhere.length * 6),
      });
    }
  }

  // Questions where competitors were recommended and the owner was absent
  if (successful > 0 && ownerAbsentQuestions.length && competitorRecommendedAnywhere) {
    const absent = ownerAbsentQuestions.slice(0, 5);
    out.push({
      ruleId: "answer_absent_questions",
      title: "Answer the questions where you were not mentioned",
      why: `You were not mentioned in ${ownerAbsentQuestions.length} of ${successful} successful answers, while other businesses were recommended. Adding a short FAQ that answers these exact questions gives assistants text to draw on.`,
      evidence: absent.map((q) => checkRef(q.checkId, `Not mentioned: "${q.questionText}"`)),
      suggestedCopy: faqCopy(business, absent.map((q) => q.questionText)),
      effort: "medium",
      score: Math.min(80, 52 + ownerAbsentQuestions.length * 4),
    });
  }

  return out.sort((a, b) => b.score - a.score || EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] || a.ruleId.localeCompare(b.ruleId));
}

export function topThree(recs: Recommendation[]): Recommendation[] {
  return recs.slice(0, 3);
}

function label(ruleId: string): string {
  return { "contact.phone": "phone number", "location.address": "street address", "location.hours": "opening hours", "contact.page": "contact page" }[ruleId] ?? ruleId;
}

function contactBlock(b: Business): string {
  return [
    `${b.name}`,
    `[Street address], ${b.city}, ${b.region}`,
    `Phone: [your phone number]`,
    `Hours: Mon–Fri [open]–[close], Sat [open]–[close], Sun closed`,
    `Serving ${b.serviceArea}.`,
  ].join("\n");
}

function homepageCopy(b: Business): string {
  const svc = b.services.slice(0, 2).join(" and ");
  return [
    `Page title: ${b.name} – ${titleCase(b.category)} in ${b.city}, ${b.region}`,
    `Headline: ${titleCase(b.category)} in ${b.city}`,
    `Intro: ${b.name} is a ${b.category.toLowerCase()} in ${b.city}, ${b.region}, offering ${svc} for ${b.serviceArea}. Call us or book online.`,
  ].join("\n");
}

function servicesCopy(b: Business, services: string[]): string {
  return services
    .slice(0, 5)
    .map((s) => `## ${titleCase(s)} in ${b.city}\n${b.name} provides ${s.toLowerCase()} for customers in ${b.serviceArea}. [One or two sentences on what is included, typical timing, and how to book.]`)
    .join("\n\n");
}

function faqCopy(b: Business, questions: string[]): string {
  return questions.map((q) => `**${q}**\n${b.name} in ${b.city} [answer in one or two plain sentences, naming the service and area].`).join("\n\n");
}

function jsonLdCopy(b: Business): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: b.websiteUrl,
    telephone: "[your phone number]",
    address: { "@type": "PostalAddress", streetAddress: "[street address]", addressLocality: b.city, addressRegion: b.region, addressCountry: b.country },
    areaServed: b.serviceArea,
    openingHours: ["Mo-Fr 09:00-17:00"],
    makesOffer: b.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
