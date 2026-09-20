import { isSameSite } from "@/lib/url/safety";
import type { PlatformCitation } from "@/lib/platforms/types";

export interface NormalizedCitation {
  url: string;
  domain: string;
  title: string | null;
  isOwnerDomain: boolean;
  position: number;
}

export function normalizeCitations(citations: PlatformCitation[], ownerDomain: string): NormalizedCitation[] {
  const seen = new Set<string>();
  const out: NormalizedCitation[] = [];
  for (const c of citations) {
    let url: URL;
    try {
      url = new URL(c.url);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const domain = url.hostname.toLowerCase().replace(/^www\./, "");
    out.push({
      url: key,
      domain,
      title: c.title?.trim() || null,
      isOwnerDomain: isSameSite(url.hostname, ownerDomain),
      position: out.length + 1,
    });
  }
  return out;
}
