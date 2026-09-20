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
});

export type BusinessInput = z.infer<typeof businessInputSchema>;

export interface LocationContext {
  city: string;
  region: string;
  country: string;
  timezone?: string;
}

export interface Business extends Omit<BusinessInput, "timezone"> {
  timezone?: string;
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
