import type { ParsedPage } from "@/lib/crawl/parse";
import { findNameMatches } from "@/lib/analyze/names";
import { phoneDigits, type BusinessType } from "@/lib/business/schema";

export type Severity = "good" | "warn" | "missing";
export type Category = "services" | "location" | "contact" | "technical";

export interface Finding {
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  evidence?: { pageUrl: string; excerpt?: string };
  pageUrl?: string;
}

export interface AuditContext {
  name: string;
  aliases: string[];
  city: string;
  region: string;
  services: string[];
  websiteUrl: string;
  /** Owner-confirmed facts; undefined means unconfirmed, so rules check presence only. */
  phone?: string;
  hours?: string;
  businessType?: BusinessType;
}

const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/;
const ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|way|court|ct\.?|place|pl\.?|highway|hwy\.?|parkway|pkwy\.?|square|sq\.?|terrace|ter\.?|circle|cir\.?|suite|ste\.?)\b/i;
const HOURS_RE = /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(?:-|to|–|through)?\s*(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*\.?\s*:?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to|–)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bopen\s+(?:24\s*hours|daily|every day|7 days)\b|\bhours\s*(?:of operation)?:/i;

function excerptAround(text: string, re: RegExp, len = 120): string | undefined {
  const m = re.exec(text);
  if (!m || m.index === undefined) return undefined;
  const start = Math.max(0, m.index - 30);
  return text.slice(start, Math.min(text.length, m.index + m[0].length + (len - 30))).trim();
}

function findLocalBusinessJsonLd(pages: ParsedPage[]): { page: ParsedPage; node: Record<string, unknown> } | null {
  for (const page of pages) {
    for (const node of page.jsonLd) {
      const found = walkJsonLd(node);
      if (found) return { page, node: found };
    }
  }
  return null;
}

function walkJsonLd(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 4) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = walkJsonLd(n, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && /LocalBusiness|Organization|Dentist|Restaurant|Store|Physician|AutoRepair|Plumber|Electrician|HomeAndConstructionBusiness|MedicalBusiness|LegalService|FinancialService|FoodEstablishment|LodgingBusiness|HealthAndBeautyBusiness|ProfessionalService|SportsActivityLocation|EntertainmentBusiness|Attorney|Accounting|RealEstateAgent|Locksmith|HVACBusiness|RoofingContractor|MovingCompany|PetStore|VeterinaryCare|ChildCare|DryCleaningOrLaundry|EmploymentAgency|TravelAgency|AutoDealer|Bakery|CafeOrCoffeeShop|BarOrPub|Florist|Hotel|GasStation|HairSalon|NailSalon|DaySpa|BeautySalon|TattooParlor|Library|Museum|Winery|Brewery|Distillery|Pharmacy|Optician|Dentist|Hospital|InsuranceAgency|BankOrCreditUnion|ExerciseGym|GolfCourse|BowlingAlley|MovieTheater|NightClub|ComedyClub|Casino|AmusementPark|ArtGallery|Church|ShoppingCenter|ClothingStore|ConvenienceStore|DepartmentStore|ElectronicsStore|Florist|FurnitureStore|GardenStore|GroceryStore|HardwareStore|HobbyShop|HomeGoodsStore|JewelryStore|LiquorStore|MensClothingStore|MobilePhoneStore|MovieRentalStore|MusicStore|OfficeEquipmentStore|OutletStore|PawnShop|ShoeStore|SportingGoodsStore|TireShop|ToyStore|WholesaleStore/.test(t))) {
    return obj;
  }
  if (obj["@graph"]) return walkJsonLd(obj["@graph"], depth + 1);
  return null;
}

/** Runs every audit rule over the fetched pages. Pure function; no network. */
export function runAuditRules(ctx: AuditContext, pages: ParsedPage[]): Finding[] {
  const findings: Finding[] = [];
  if (pages.length === 0) return findings;
  const all = pages.map((p) => p.text).join("\n");
  const home = pages[0];

  // --- Contact ---
  const pagesRead = pages.length;
  const coverage = `the ${pagesRead} page${pagesRead === 1 ? "" : "s"} we read`;
  const telPage = pages.find((p) => p.telLinks.length > 0);
  const phonePage = telPage ?? pages.find((p) => PHONE_RE.test(p.text));
  const confirmedDigits = ctx.phone ? phoneDigits(ctx.phone) : null;
  const foundDigits = new Set<string>();
  for (const p of pages) {
    for (const t of p.telLinks) foundDigits.add(phoneDigits(t));
    for (const m of p.text.matchAll(new RegExp(PHONE_RE.source, "g"))) foundDigits.add(phoneDigits(m[0]));
  }
  const confirmedFound = confirmedDigits ? [...foundDigits].some((d) => d.endsWith(confirmedDigits) || confirmedDigits.endsWith(d)) : null;
  if (confirmedDigits && phonePage && confirmedFound === false) {
    findings.push({ ruleId: "contact.phone", category: "contact", severity: "warn", title: "Phone number on the site differs from the one you gave us", detail: `In ${coverage} we found a phone number that does not match ${ctx.phone}. Check which one is right and use it everywhere.`, evidence: { pageUrl: phonePage.url, excerpt: excerptAround(phonePage.text, PHONE_RE) }, pageUrl: phonePage.url });
  } else if (telPage) {
    findings.push({ ruleId: "contact.phone", category: "contact", severity: "good", title: confirmedFound ? "Your confirmed phone number is easy to find" : "Phone number is easy to find", detail: `A clickable phone link was found on ${shortUrl(telPage.url)}.`, evidence: { pageUrl: telPage.url, excerpt: telPage.telLinks[0] }, pageUrl: telPage.url });
  } else if (phonePage) {
    findings.push({ ruleId: "contact.phone", category: "contact", severity: "warn", title: "Phone number is text only", detail: "We found a phone number, but it is not a clickable link. Making it clickable helps visitors on phones and makes the number easier for tools to recognise.", evidence: { pageUrl: phonePage.url, excerpt: excerptAround(phonePage.text, PHONE_RE) }, pageUrl: phonePage.url });
  } else {
    findings.push({ ruleId: "contact.phone", category: "contact", severity: "missing", title: "No phone number found", detail: `We could not find a phone number in ${coverage}. Add it to the header or footer of every page.` });
  }

  const contactPage = pages.find((p) => /\/(contact|contact-us|get-in-touch|reach-us)\b/i.test(new URL(p.url).pathname));
  const contactLink = home.links.find((l) => /contact/i.test(l));
  if (contactPage) {
    findings.push({ ruleId: "contact.page", category: "contact", severity: "good", title: "Contact page found", detail: `We checked ${shortUrl(contactPage.url)}.`, pageUrl: contactPage.url });
  } else if (contactLink) {
    findings.push({ ruleId: "contact.page", category: "contact", severity: "warn", title: "Contact page linked but not readable", detail: "Your homepage links to a contact page, but we could not read it. Check that it loads and is not blocked." });
  } else {
    findings.push({ ruleId: "contact.page", category: "contact", severity: "missing", title: "No contact page found", detail: "Add a simple contact page with your phone, address, hours, and a short form or email." });
  }

  // --- Location ---
  const addrPage = pages.find((p) => ADDRESS_RE.test(p.text));
  if (addrPage) {
    findings.push({ ruleId: "location.address", category: "location", severity: "good", title: "Street address found", detail: `An address appears on ${shortUrl(addrPage.url)}.`, evidence: { pageUrl: addrPage.url, excerpt: excerptAround(addrPage.text, ADDRESS_RE) }, pageUrl: addrPage.url });
  } else if (ctx.businessType === "service_area") {
    findings.push({ ruleId: "location.address", category: "location", severity: "good", title: "No street address, and none needed", detail: "You told us you serve customers at their location, so we do not expect a public street address. Make sure the area you serve is stated instead." });
  } else {
    findings.push({ ruleId: "location.address", category: "location", severity: "missing", title: "No street address found", detail: `We did not find a street address in ${coverage}. If customers visit you, add the full address to your footer and contact page. If you only travel to customers, tell us in Settings and we will stop asking.` });
  }

  const cityRe = new RegExp(`\\b${escapeRe(ctx.city)}\\b`, "i");
  const cityPage = pages.find((p) => cityRe.test(p.text) || cityRe.test(p.title));
  const cityOnHome = cityRe.test(home.text) || cityRe.test(home.title) || cityRe.test(home.metaDescription);
  if (cityOnHome) {
    findings.push({ ruleId: "location.city", category: "location", severity: "good", title: `Your city (${ctx.city}) is named on the homepage`, detail: "Naming your city and area on the homepage helps assistants connect you to local questions.", evidence: { pageUrl: home.url, excerpt: excerptAround(home.text, cityRe) }, pageUrl: home.url });
  } else if (cityPage) {
    findings.push({ ruleId: "location.city", category: "location", severity: "warn", title: `Your city (${ctx.city}) is not on the homepage`, detail: `We found it on ${shortUrl(cityPage.url)} but not on the homepage. Add it to the homepage title and a headline.`, evidence: { pageUrl: cityPage.url, excerpt: excerptAround(cityPage.text, cityRe) }, pageUrl: cityPage.url });
  } else {
    findings.push({ ruleId: "location.city", category: "location", severity: "missing", title: `Your city (${ctx.city}) does not appear on the site`, detail: "Assistants often match businesses to a place by the city name. Add your city and the area you serve to the homepage and contact page." });
  }

  if (HOURS_RE.test(all)) {
    const hp = pages.find((p) => HOURS_RE.test(p.text)) ?? home;
    findings.push({ ruleId: "location.hours", category: "location", severity: "good", title: "Opening hours found", detail: `Hours appear on ${shortUrl(hp.url)}.`, evidence: { pageUrl: hp.url, excerpt: excerptAround(hp.text, HOURS_RE) }, pageUrl: hp.url });
  } else {
    findings.push({ ruleId: "location.hours", category: "location", severity: "missing", title: "No opening hours found", detail: `We did not find opening hours in ${coverage}. ${ctx.hours ? `You told us your hours are "${ctx.hours}"; publish them in plain text (not only in an image).` : "Add your hours in plain text (not only in an image)."}` });
  }

  // --- Services ---
  const serviceHits = ctx.services.map((svc) => ({ svc, found: pages.some((p) => new RegExp(escapeRe(svc), "i").test(`${p.title} ${p.metaDescription} ${p.text}`)) }));
  const missingServices = serviceHits.filter((s) => !s.found).map((s) => s.svc);
  if (serviceHits.length && missingServices.length === 0) {
    findings.push({ ruleId: "services.named", category: "services", severity: "good", title: "All your main services are named on the site", detail: `We found: ${ctx.services.join(", ")}.` });
  } else if (missingServices.length < serviceHits.length) {
    findings.push({ ruleId: "services.named", category: "services", severity: "warn", title: "Some services are not named on the site", detail: `We could not find: ${missingServices.join(", ")}. Add a short section or page for each.` });
  } else {
    findings.push({ ruleId: "services.named", category: "services", severity: "missing", title: "Your main services are not named on the site", detail: `None of these appear in the page text: ${ctx.services.join(", ")}. This is what ${coverage} showed; other sources may still describe your services, but your own site is the one you control.` });
  }

  const servicesPage = pages.find((p) => /\/(services?|what-we-do|treatments|menu|pricing)\b/i.test(new URL(p.url).pathname));
  if (servicesPage) {
    findings.push({ ruleId: "services.page", category: "services", severity: "good", title: "Services page found", detail: `We checked ${shortUrl(servicesPage.url)}.`, pageUrl: servicesPage.url });
  } else {
    findings.push({ ruleId: "services.page", category: "services", severity: "warn", title: "No dedicated services page found", detail: "A page that lists each service with a sentence or two of detail gives assistants something specific to cite." });
  }

  // --- Technical ---
  const thinPages = pages.filter((p) => p.text.length < 200);
  if (thinPages.length === pages.length) {
    findings.push({ ruleId: "technical.readable", category: "technical", severity: "warn", title: "We could read very little text on your site", detail: "The pages we fetched contain almost no plain text. If your site builds its content with scripts, our checks (and some other tools) may be incomplete. Treat the findings below as unable to verify rather than as missing." });
  } else if (thinPages.length > 0) {
    findings.push({ ruleId: "technical.readable", category: "technical", severity: "good", title: `Site text is readable (${pages.length - thinPages.length} of ${pages.length} pages had substantial text)`, detail: "Our checks could read the main pages." });
  } else {
    findings.push({ ruleId: "technical.readable", category: "technical", severity: "good", title: "Site text is readable", detail: `All ${pagesRead} fetched pages had substantial plain text.` });
  }
  const nameOnHome = findNameMatches(`${home.title}\n${home.text}`, [ctx.name, ...ctx.aliases]).length > 0;
  findings.push(
    nameOnHome
      ? { ruleId: "technical.name", category: "technical", severity: "good", title: "Business name appears on the homepage", detail: `We found "${ctx.name}" on the homepage.`, pageUrl: home.url }
      : { ruleId: "technical.name", category: "technical", severity: "missing", title: "Business name not found on the homepage", detail: `We could not find "${ctx.name}" in the homepage title or text. Make sure the exact name customers use is written out, not only in a logo image.` },
  );

  if (!home.title) {
    findings.push({ ruleId: "technical.title", category: "technical", severity: "missing", title: "Homepage has no title", detail: "Add a page title like 'Business Name - Service in City'." });
  } else if (!cityRe.test(home.title) || !nameOnHome) {
    findings.push({ ruleId: "technical.title", category: "technical", severity: "warn", title: "Homepage title could be clearer", detail: `Current title: "${home.title}". A title with your name, main service, and city is easier for assistants to summarise.`, evidence: { pageUrl: home.url, excerpt: home.title } });
  } else {
    findings.push({ ruleId: "technical.title", category: "technical", severity: "good", title: "Homepage title is descriptive", detail: `"${home.title}"`, pageUrl: home.url });
  }

  findings.push(
    home.metaDescription
      ? { ruleId: "technical.meta", category: "technical", severity: "good", title: "Homepage has a description", detail: `"${home.metaDescription.slice(0, 160)}"`, pageUrl: home.url }
      : { ruleId: "technical.meta", category: "technical", severity: "warn", title: "Homepage has no description", detail: "A one-sentence description (name, services, city) gives search and AI tools a clean summary." },
  );

  const ld = findLocalBusinessJsonLd(pages);
  if (ld) {
    const hasAddress = Boolean(ld.node["address"]);
    const hasPhone = Boolean(ld.node["telephone"]);
    findings.push({
      ruleId: "technical.schema",
      category: "technical",
      severity: hasAddress && hasPhone ? "good" : "warn",
      title: hasAddress && hasPhone ? "Structured business data found" : "Structured business data is incomplete",
      detail: hasAddress && hasPhone ? `LocalBusiness data with address and phone is on ${shortUrl(ld.page.url)}.` : `LocalBusiness data was found on ${shortUrl(ld.page.url)} but it is missing ${[!hasAddress && "address", !hasPhone && "telephone"].filter(Boolean).join(" and ")}.`,
      pageUrl: ld.page.url,
    });
  } else {
    findings.push({ ruleId: "technical.schema", category: "technical", severity: "missing", title: "No structured business data (LocalBusiness) found", detail: "A small block of structured data tells machines your name, address, phone, hours, and services in a standard format." });
  }

  findings.push(
    ctx.websiteUrl.startsWith("https://") || pages[0].url.startsWith("https://")
      ? { ruleId: "technical.https", category: "technical", severity: "good", title: "Site uses HTTPS", detail: "Your site is served securely." }
      : { ruleId: "technical.https", category: "technical", severity: "warn", title: "Site is not using HTTPS", detail: "Ask your web host to turn on HTTPS. Many tools distrust plain http sites." },
  );

  return findings;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortUrl(u: string): string {
  try {
    const url = new URL(u);
    return url.pathname === "/" ? url.hostname : `${url.hostname}${url.pathname}`;
  } catch {
    return u;
  }
}
