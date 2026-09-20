import type { Business } from "@/lib/business/schema";
import type { RunMetrics } from "@/lib/metrics/compute";
import type { Finding } from "@/lib/audit/rules";
import type { PageStatus } from "@/lib/audit/run";
import type { CitationRecord } from "@/lib/analyze/store";

export type Effort = "low" | "medium" | "high";

/** Every reference resolves to a stored row the owner can open. */
export type EvidenceRef =
  | { type: "check"; id: string; excerpt: string }
  | { type: "finding"; id: string; excerpt: string; ruleId: string }
  | { type: "citation"; id: string; checkId: string; excerpt: string }
  | { type: "audit"; id: string; excerpt: string };

export interface Recommendation {
  ruleId: string;
  title: string;
  why: string;
  evidence: EvidenceRef[];
  suggestedCopy: string | null;
  /** Which fields still need the owner's confirmation before the copy is publishable. */
  needsConfirmation: string[];
  effort: Effort;
  score: number;
  /** Identifies the finding so completion status carries only across the same scope. */
  scope: string;
  /** Audit rule ids that a verification re-audit must find "good" for this action to be verified. */
  verifyRules: string[];
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
  citations: CitationRecord[];
  dataMode: "live" | "demo";
}

const EFFORT_ORDER: Record<Effort, number> = { low: 0, medium: 1, high: 2 };

/**
 * Produces evidence-backed improvement opportunities. Every recommendation cites
 * stored checks, citations, or audit findings. Nothing here claims causation, and
 * no suggested copy invents a business fact the owner has not confirmed.
 */
export function buildRecommendations(input: RecommendInput): Recommendation[] {
  const out: Recommendation[] = [];
  const { business, metrics, audit, citations } = input;
  const findings = audit?.status === "complete" ? audit.findings : [];
  const f = (ruleId: string) => findings.find((x) => x.ruleId === ruleId);
  const sev = (ruleId: string): Finding["severity"] | null => f(ruleId)?.severity ?? null;
  const ref = (finding: Finding & { id: string }): EvidenceRef => ({ type: "finding", id: finding.id, excerpt: finding.title, ruleId: finding.ruleId });
  const successful = metrics.successfulChecks;
  const ownerAbsentQuestions = metrics.questions.filter((q) => q.status === "success" && !q.ownerMentioned);
  const competitorRecommendedAnywhere = metrics.competitors.some((c) => c.recommended > 0);
  const checkRef = (checkId: string, excerpt: string): EvidenceRef => ({ type: "check", id: checkId, excerpt });
  const pagesRead = audit?.pages.filter((p) => p.fetched).length ?? 0;
  const coverage = pagesRead ? ` in the ${pagesRead} page${pagesRead === 1 ? "" : "s"} we read` : "";

  if (audit && audit.status === "failed_fetch") {
    const first = audit.pages[0];
    out.push({
      ruleId: "website_unreachable",
      title: "Make sure your website loads for visitors and tools",
      why: `Our check could not read your website (${first?.error ?? "unknown reason"}). We cannot tell from this whether other tools can reach it, but a site that fails to load is worth checking first.`,
      evidence: [{ type: "audit", id: audit.id, excerpt: `${first?.url ?? business.websiteUrl}: ${first?.error ?? "not reachable"}` }],
      suggestedCopy: null,
      needsConfirmation: [],
      effort: "high",
      score: 95,
      scope: `website_unreachable:${business.websiteDomain}`,
      verifyRules: [],
    });
  }

  // Contact details. Service-area businesses are not asked to publish an address.
  const contactRules = (business.businessType === "service_area" ? ["contact.phone", "location.hours", "contact.page"] : ["contact.phone", "location.address", "location.hours", "contact.page"]) as string[];
  const contactMissing = contactRules.filter((r) => sev(r) === "missing");
  const contactWarn = contactRules.filter((r) => sev(r) === "warn");
  if (contactMissing.length || contactWarn.length) {
    const ev = [...contactMissing, ...contactWarn].map((r) => ref(f(r)!));
    const copy = contactBlock(business);
    out.push({
      ruleId: "contact_details",
      title: "Put your phone, hours, and how to reach you on every page",
      why: `Your website audit found${coverage} ${contactMissing.length ? `missing: ${contactMissing.map(label).join(", ")}` : ""}${contactMissing.length && contactWarn.length ? "; " : ""}${contactWarn.length ? `needs attention: ${contactWarn.map(label).join(", ")}` : ""}. Clear contact details are what customers act on when an answer names you.`,
      evidence: ev,
      suggestedCopy: copy.text,
      needsConfirmation: copy.needs,
      effort: "low",
      score: contactMissing.length ? 78 + Math.min(10, contactMissing.length * 3) : 50,
      scope: `contact_details:${[...contactMissing, ...contactWarn].sort().join(",")}`,
      verifyRules: [...contactMissing, ...contactWarn],
    });
  }

  const cityMissing = sev("location.city");
  const nameMissing = sev("technical.name");
  const titleSev = sev("technical.title");
  if (cityMissing === "missing" || cityMissing === "warn" || nameMissing === "missing" || titleSev === "missing" || titleSev === "warn") {
    const related = [f("location.city"), f("technical.name"), f("technical.title")].filter((x): x is Finding & { id: string } => Boolean(x) && x!.severity !== "good");
    const copy = homepageCopy(business);
    out.push({
      ruleId: "name_city_on_homepage",
      title: "Say who you are and where you are on the homepage",
      why: `The homepage should state "${business.name}" and "${business.city}" in the page title and a headline. ${cityMissing === "missing" ? `We did not find ${business.city}${coverage}.` : cityMissing === "warn" ? `${business.city} appears on an inner page but not the homepage.` : ""} ${nameMissing === "missing" ? "We also could not find your business name in the homepage text." : ""}`.trim(),
      evidence: related.map(ref),
      suggestedCopy: copy.text,
      needsConfirmation: copy.needs,
      effort: "low",
      score: cityMissing === "missing" || nameMissing === "missing" ? 82 : 60,
      scope: `name_city_on_homepage:${related.map((r) => r.ruleId).sort().join(",")}`,
      verifyRules: related.map((r) => r.ruleId),
    });
  }

  const servicesNamed = sev("services.named");
  const servicesPage = sev("services.page");
  if (servicesNamed === "missing" || servicesNamed === "warn" || servicesPage === "warn") {
    const missingList = f("services.named")?.detail.match(/could not find: ([^.]+)\./)?.[1] ?? f("services.named")?.detail.match(/page text: ([^.]+)\./)?.[1] ?? "";
    const missing = missingList ? missingList.split(",").map((s) => s.trim()).filter(Boolean) : business.services;
    const related = [f("services.named"), f("services.page")].filter((x): x is Finding & { id: string } => Boolean(x) && x!.severity !== "good");
    const ev: EvidenceRef[] = related.map(ref);
    const serviceQuestionsAbsent = ownerAbsentQuestions.filter((q) => business.services.some((s) => q.questionText.toLowerCase().includes(s.toLowerCase())));
    for (const q of serviceQuestionsAbsent.slice(0, 2)) ev.push(checkRef(q.checkId, `Not mentioned for: "${q.questionText}"`));
    out.push({
      ruleId: "service_pages",
      title: "Describe each main service in plain words",
      why: `${servicesNamed === "missing" ? `We did not find any of your main services named${coverage}.` : servicesNamed === "warn" ? `Some services are not named${coverage} (${missing.join(", ")}).` : "There is no dedicated services page."} ${serviceQuestionsAbsent.length ? `In this check you were not mentioned for ${serviceQuestionsAbsent.length} service-specific question${serviceQuestionsAbsent.length === 1 ? "" : "s"}.` : ""} Clear service descriptions give customers and tools something specific to read; we cannot promise they change any answer.`.trim(),
      evidence: ev,
      suggestedCopy: servicesCopy(business, missing),
      needsConfirmation: ["what each service includes", "how to book"],
      effort: "medium",
      score: (servicesNamed === "missing" ? 74 : 62) + (serviceQuestionsAbsent.length ? 8 : 0),
      scope: `service_pages:${missing.map((m) => m.toLowerCase()).sort().join("|")}`,
      verifyRules: related.map((r) => r.ruleId),
    });
  }

  const schemaSev = sev("technical.schema");
  if (schemaSev === "missing" || schemaSev === "warn") {
    const copy = jsonLdCopy(business);
    out.push({
      ruleId: "local_business_schema",
      title: "Add structured business data to your site",
      why: `${schemaSev === "missing" ? "Your site has no LocalBusiness structured data." : "Your structured data is incomplete."} This is a small block of code that lists your name, address or service area, phone, hours, and services in a standard format that search and AI tools can read directly.${metrics.citationRate.denominator > 0 && metrics.citationRate.numerator === 0 ? ` Your website was not cited in any of the ${metrics.citationRate.denominator} answers with readable sources in this check.` : ""} It is a clarity improvement, not a placement guarantee.`,
      evidence: [ref(f("technical.schema")!)],
      suggestedCopy: copy.text,
      needsConfirmation: copy.needs,
      effort: "medium",
      score: (schemaSev === "missing" ? 66 : 48) + (metrics.citationRate.denominator > 0 && metrics.citationRate.numerator === 0 ? 10 : 0),
      scope: `local_business_schema:${business.websiteDomain}`,
      verifyRules: ["technical.schema"],
    });
  }

  // Sources the assistants cite that are not the owner: page-level, with real citation rows as evidence.
  if (successful > 0) {
    const citedElsewhere = metrics.topDomains.filter((d) => !d.isOwnerDomain && d.checks >= 2).slice(0, 4);
    if (citedElsewhere.length) {
      const ev: EvidenceRef[] = [];
      for (const d of citedElsewhere) {
        const c = citations.find((x) => x.domain === d.domain);
        if (c) ev.push({ type: "citation", id: c.id, checkId: c.checkId, excerpt: `${c.url} (cited in ${d.checks} of ${successful} answers)` });
      }
      if (ev.length) {
        out.push({
          ruleId: "get_listed_on_cited_sources",
          title: "Check how you appear on the pages the assistants cite",
          why: `Across ${successful} successful answers, these sources were cited most often: ${citedElsewhere.map((d) => `${d.domain} (${d.checks} of ${successful})`).join(", ")}. Your own site was cited in ${metrics.citationRate.numerator} of ${metrics.citationRate.denominator}. Open each cited page: some are directories or review sites where you can claim or correct a profile, others are competitors or articles with nothing to submit. We have not checked whether you already appear on them.`,
          evidence: ev,
          suggestedCopy: null,
          needsConfirmation: [],
          effort: "medium",
          score: Math.min(85, 58 + ev.length * 6),
          scope: `get_listed_on_cited_sources:${citedElsewhere.map((d) => d.domain).sort().join(",")}`,
          verifyRules: [],
        });
      }
    }
  }

  if (successful > 0 && ownerAbsentQuestions.length && competitorRecommendedAnywhere) {
    const absent = ownerAbsentQuestions.slice(0, 5);
    out.push({
      ruleId: "answer_absent_questions",
      title: "Answer the questions where you were not mentioned",
      why: `You were not mentioned in ${ownerAbsentQuestions.length} of ${successful} successful answers, while other businesses were recommended. A short FAQ that answers these exact questions gives readers and tools plain text to draw on; whether an assistant uses it is not something we can promise.`,
      evidence: absent.map((q) => checkRef(q.checkId, `Not mentioned: "${q.questionText}"`)),
      suggestedCopy: faqCopy(business, absent.map((q) => q.questionText)),
      needsConfirmation: ["each answer's details"],
      effort: "medium",
      score: Math.min(80, 52 + ownerAbsentQuestions.length * 4),
      scope: `answer_absent_questions:${absent.map((q) => q.questionId).sort().join(",")}`,
      verifyRules: [],
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

/** Contact block built only from confirmed facts; unconfirmed fields are bracketed placeholders. */
export function contactBlock(b: Business): { text: string; needs: string[] } {
  const needs: string[] = [];
  const lines = [b.name];
  if (b.businessType === "service_area") {
    lines.push(`Serving ${b.serviceArea}.`);
  } else {
    lines.push(`[Street address], ${b.city}, ${b.region}`);
    needs.push("street address");
  }
  if (b.phone) lines.push(`Phone: ${b.phone}`);
  else {
    lines.push("Phone: [your phone number]");
    needs.push("phone number");
  }
  if (b.hours) lines.push(`Hours: ${b.hours}`);
  else {
    lines.push("Hours: [your opening days and times]");
    needs.push("opening hours");
  }
  if (b.businessType !== "service_area") lines.push(`Serving ${b.serviceArea}.`);
  if (b.bookingUrl) lines.push(`Book online: ${b.bookingUrl}`);
  return { text: lines.join("\n"), needs };
}

export function homepageCopy(b: Business): { text: string; needs: string[] } {
  const svc = (b.priorityServices.length ? b.priorityServices : b.services).slice(0, 2).join(" and ");
  const contact = b.bookingUrl ? "Call us or book online." : b.phone ? `Call ${b.phone}.` : "[How customers should contact you.]";
  const needs = b.bookingUrl || b.phone ? [] : ["how customers should contact you"];
  return {
    text: [
      `Page title: ${b.name} – ${titleCase(b.category)} in ${b.city}, ${b.region}`,
      `Headline: ${titleCase(b.category)} in ${b.city}`,
      `Intro: ${b.name} is a ${b.category.toLowerCase()} in ${b.city}, ${b.region}, offering ${svc} for ${b.serviceArea}. ${contact}`,
    ].join("\n"),
    needs,
  };
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

/**
 * Valid JSON-LD containing only confirmed facts. Missing facts are omitted from
 * the code (so nothing false is published) and listed for the owner to add.
 */
export function jsonLdCopy(b: Business): { text: string; needs: string[] } {
  const needs: string[] = [];
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: b.websiteUrl,
  };
  if (b.phone) data.telephone = b.phone;
  else needs.push("telephone");
  if (b.businessType === "service_area") {
    data.areaServed = b.serviceArea;
    data.address = { "@type": "PostalAddress", addressLocality: b.city, addressRegion: b.region, addressCountry: b.country };
  } else {
    data.address = { "@type": "PostalAddress", addressLocality: b.city, addressRegion: b.region, addressCountry: b.country };
    needs.push("streetAddress inside address");
    data.areaServed = b.serviceArea;
  }
  if (b.hours) needs.push(`openingHours in schema.org format matching: ${b.hours}`);
  else needs.push("openingHours (confirm your hours first)");
  if (b.bookingUrl) data.potentialAction = { "@type": "ReserveAction", target: b.bookingUrl };
  data.makesOffer = b.services.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s } }));
  const text = `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>\n\nStill to add before publishing: ${needs.join("; ")}.`;
  return { text, needs };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
