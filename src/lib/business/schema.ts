import { z } from "zod";
import { COUNTRY_SET } from "./countries";
import { parsePublicHttpUrl } from "@/lib/url/safety";
import { hasControlChars } from "@/lib/text/clean";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} needs at least ${min} characters`)
    .max(max, `${label} can be at most ${max} characters`)
    .refine((s) => !hasControlChars(s), `${label} contains characters we cannot use`);

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Digits only, for comparing phone numbers found on pages with the confirmed one. */
export function phoneDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export const BUSINESS_TYPES = ["unknown", "storefront", "service_area", "hybrid"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} can be at most ${max} characters`)
    .refine((s) => !hasControlChars(s), `${label} contains characters we cannot use`)
    .optional()
    .transform((s) => (s ? s : undefined));

export const businessInputSchema = z.object({
  name: trimmed(2, 120, "Business name"),
  aliases: z.array(trimmed(2, 120, "Other name")).max(5, "You can add up to 5 other names").default([]),
  websiteUrl: z
    .string()
    .trim()
    .min(1, "Please enter your website address")
    .max(2048)
    .superRefine((value, ctx) => {
      const check = parsePublicHttpUrl(value);
      if (!check.ok) ctx.addIssue({ code: "custom", message: check.reason });
    }),
  category: trimmed(2, 80, "Business type"),
  city: trimmed(2, 80, "City"),
  region: trimmed(2, 80, "State or region"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => COUNTRY_SET.has(c), "Please choose a country"),
  timezone: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((tz) => (tz ? tz : undefined))
    .refine((tz) => !tz || isValidTimezone(tz), "That time zone is not recognized"),
  serviceArea: trimmed(2, 200, "Service area"),
  services: z
    .array(trimmed(2, 60, "Service"))
    .min(1, "Add at least one service")
    .max(15, "You can add up to 15 services"),
  // Owner-confirmed public facts. All optional; never invented when absent.
  phone: optionalText(40, "Phone number").refine((p) => !p || (phoneDigits(p).length >= 7 && phoneDigits(p).length <= 15), "Please enter a phone number with 7 to 15 digits"),
  hours: optionalText(200, "Opening hours"),
  businessType: z.enum(BUSINESS_TYPES).default("unknown"),
  bookingUrl: optionalText(2048, "Booking link").refine((u) => !u || parsePublicHttpUrl(u).ok, "Please enter a full web address for booking, like https://example.com/book"),
  priorityServices: z.array(trimmed(2, 60, "Service")).max(5, "Choose up to 5 priority services").default([]),
});

export type BusinessInput = z.infer<typeof businessInputSchema>;

export interface LocationContext {
  city: string;
  region: string;
  country: string;
  timezone?: string;
}

export interface Business extends Omit<BusinessInput, "timezone" | "phone" | "hours" | "bookingUrl"> {
  timezone?: string;
  phone?: string;
  hours?: string;
  bookingUrl?: string;
  /** When the owner last saved the public-facts group; null means facts are unconfirmed. */
  factsConfirmedAt: string | null;
  id: string;
  userId: string;
  websiteDomain: string;
  schedule: "off" | "weekly" | "monthly";
  createdAt: string;
  updatedAt: string;
}

export function locationOf(b: Pick<Business, "city" | "region" | "country" | "timezone">): LocationContext {
  return {
    city: b.city,
    region: b.region,
    country: b.country,
    ...(b.timezone ? { timezone: b.timezone } : {}),
  };
}

/** True when the owner has confirmed at least one public fact. */
export function hasConfirmedFacts(b: Business): boolean {
  return Boolean(b.phone || b.hours || b.bookingUrl || b.businessType !== "unknown");
}

/** Splits "a, b, c" or newline separated text into trimmed, de-duplicated items. */
export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[\n,]/)) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
