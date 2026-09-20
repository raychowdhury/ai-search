import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import { parsePublicHttpUrl, registrableDomain } from "@/lib/url/safety";
import type { Business, BusinessInput, BusinessType } from "./schema";

interface Row {
  id: string;
  user_id: string;
  name: string;
  aliases: string;
  website_url: string;
  website_domain: string;
  category: string;
  city: string;
  region: string;
  country: string;
  timezone: string | null;
  service_area: string;
  services: string;
  schedule: string;
  phone: string | null;
  hours: string | null;
  business_type: BusinessType;
  booking_url: string | null;
  priority_services: string;
  facts_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBusiness(r: Row): Business {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    aliases: JSON.parse(r.aliases) as string[],
    websiteUrl: r.website_url,
    websiteDomain: r.website_domain,
    category: r.category,
    city: r.city,
    region: r.region,
    country: r.country,
    timezone: r.timezone ?? undefined,
    serviceArea: r.service_area,
    services: JSON.parse(r.services) as string[],
    schedule: r.schedule as Business["schedule"],
    phone: r.phone ?? undefined,
    hours: r.hours ?? undefined,
    businessType: r.business_type ?? "unknown",
    bookingUrl: r.booking_url ?? undefined,
    priorityServices: JSON.parse(r.priority_services ?? "[]") as string[],
    factsConfirmedAt: r.facts_confirmed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const COLUMNS =
  "id, user_id, name, aliases, website_url, website_domain, category, city, region, country, timezone, service_area, services, schedule, phone, hours, business_type, booking_url, priority_services, facts_confirmed_at, created_at, updated_at";

export function getBusinessForUser(db: Db, userId: string): Business | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM businesses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(userId) as Row | undefined;
  return row ? rowToBusiness(row) : null;
}

export function getBusinessById(db: Db, id: string): Business | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM businesses WHERE id = ?`).get(id) as Row | undefined;
  return row ? rowToBusiness(row) : null;
}

function factsProvided(input: BusinessInput): boolean {
  return Boolean(input.phone || input.hours || input.bookingUrl || input.businessType !== "unknown");
}

export function saveBusiness(db: Db, userId: string, input: BusinessInput): Business {
  const urlCheck = parsePublicHttpUrl(input.websiteUrl);
  if (!urlCheck.ok) throw new Error(urlCheck.reason);
  const websiteUrl = urlCheck.url.toString();
  const websiteDomain = registrableDomain(urlCheck.hostname);
  const ts = nowIso();
  // Priority services must be a subset of the services list.
  const priority = input.priorityServices.filter((p) => input.services.some((s) => s.toLowerCase() === p.toLowerCase()));
  const existing = getBusinessForUser(db, userId);
  const factsConfirmedAt = factsProvided(input) ? ts : null;
  if (existing) {
    db.prepare(
      `UPDATE businesses SET name=?, aliases=?, website_url=?, website_domain=?, category=?, city=?, region=?, country=?, timezone=?, service_area=?, services=?,
         phone=?, hours=?, business_type=?, booking_url=?, priority_services=?, facts_confirmed_at=?, updated_at=? WHERE id=?`,
    ).run(
      input.name,
      JSON.stringify(input.aliases),
      websiteUrl,
      websiteDomain,
      input.category,
      input.city,
      input.region,
      input.country,
      input.timezone ?? null,
      input.serviceArea,
      JSON.stringify(input.services),
      input.phone ?? null,
      input.hours ?? null,
      input.businessType,
      input.bookingUrl ?? null,
      JSON.stringify(priority),
      factsConfirmedAt,
      ts,
      existing.id,
    );
    return getBusinessById(db, existing.id)!;
  }
  const id = newId();
  db.prepare(`INSERT INTO businesses (${COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id,
    userId,
    input.name,
    JSON.stringify(input.aliases),
    websiteUrl,
    websiteDomain,
    input.category,
    input.city,
    input.region,
    input.country,
    input.timezone ?? null,
    input.serviceArea,
    JSON.stringify(input.services),
    "off",
    input.phone ?? null,
    input.hours ?? null,
    input.businessType,
    input.bookingUrl ?? null,
    JSON.stringify(priority),
    factsConfirmedAt,
    ts,
    ts,
  );
  return getBusinessById(db, id)!;
}

export function setSchedule(db: Db, businessId: string, schedule: Business["schedule"]): void {
  db.prepare("UPDATE businesses SET schedule = ?, updated_at = ? WHERE id = ?").run(schedule, nowIso(), businessId);
}

export function deleteBusiness(db: Db, businessId: string): void {
  db.prepare("DELETE FROM businesses WHERE id = ?").run(businessId);
}
