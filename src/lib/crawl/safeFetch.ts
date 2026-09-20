import dns from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateIp, parsePublicHttpUrl } from "@/lib/url/safety";

/**
 * Fetches a public web page with SSRF protections:
 * - http(s) only, public hostnames only (see parsePublicHttpUrl)
 * - DNS resolved first; every resolved address must be public
 * - redirects followed manually (max 5) and re-validated each hop
 * - size cap (2 MB), time cap (10 s), HTML/text only
 * - robots.txt disallow rules honoured for our user agent
 */
export const USER_AGENT = "AIVisibilityCheck/0.1 (+website audit requested by the site owner)";
export const MAX_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;

export type FetchResult =
  | { ok: true; url: string; finalUrl: string; status: number; contentType: string; body: string; bytes: number }
  | { ok: false; url: string; reason: string; code: FetchErrorCode; status?: number };

export type FetchErrorCode =
  | "invalid_url"
  | "blocked_private_network"
  | "dns_failed"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "unsupported_content"
  | "http_error"
  | "network_error"
  | "robots_disallowed";

export interface Resolver {
  resolve(hostname: string): Promise<string[]>;
}

export const systemResolver: Resolver = {
  async resolve(hostname) {
    if (isIP(hostname)) return [hostname];
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    return results.map((r) => r.address);
  },
};

export interface FetchDeps {
  resolver?: Resolver;
  fetchImpl?: typeof fetch;
  robots?: RobotsRules | null;
}

async function assertPublicHost(hostname: string, resolver: Resolver): Promise<string | null> {
  let addresses: string[];
  try {
    addresses = await resolver.resolve(hostname);
  } catch {
    return "dns_failed";
  }
  if (addresses.length === 0) return "dns_failed";
  if (addresses.some((a) => isPrivateIp(a))) return "blocked_private_network";
  return null;
}

export async function safeFetch(inputUrl: string, deps: FetchDeps = {}): Promise<FetchResult> {
  const resolver = deps.resolver ?? systemResolver;
  const fetchImpl = deps.fetchImpl ?? fetch;
  let current = inputUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = parsePublicHttpUrl(current);
    if (!check.ok) return { ok: false, url: inputUrl, reason: check.reason, code: "invalid_url" };
    const url = check.url;
    if (deps.robots && !deps.robots.isAllowed(url.pathname + url.search)) {
      return { ok: false, url: inputUrl, reason: "The site's robots.txt asks crawlers not to read this page", code: "robots_disallowed" };
    }
    const hostProblem = await assertPublicHost(check.hostname, resolver);
    if (hostProblem === "dns_failed") return { ok: false, url: inputUrl, reason: "We could not look up that web address", code: "dns_failed" };
    if (hostProblem) return { ok: false, url: inputUrl, reason: "That address points to a private or internal network", code: "blocked_private_network" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1" },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return aborted
        ? { ok: false, url: inputUrl, reason: "The site took too long to respond", code: "timeout" }
        : { ok: false, url: inputUrl, reason: "We could not connect to the site", code: "network_error" };
    }

    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const location = res.headers.get("location");
      if (!location) return { ok: false, url: inputUrl, reason: "The site redirected without a destination", code: "http_error", status: res.status };
      try {
        current = new URL(location, url).toString();
      } catch {
        return { ok: false, url: inputUrl, reason: "The site redirected to an invalid address", code: "invalid_url" };
      }
      continue;
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!res.ok) {
      clearTimeout(timer);
      return { ok: false, url: inputUrl, reason: `The site responded with an error (${res.status})`, code: "http_error", status: res.status };
    }
    if (!/text\/html|application\/xhtml\+xml|text\/plain/.test(contentType)) {
      clearTimeout(timer);
      return { ok: false, url: inputUrl, reason: "That page is not a web page we can read", code: "unsupported_content", status: res.status };
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) {
      clearTimeout(timer);
      return { ok: false, url: inputUrl, reason: "That page is too large to check", code: "too_large", status: res.status };
    }
    try {
      const body = await readLimited(res, MAX_BYTES);
      clearTimeout(timer);
      if (body === null) return { ok: false, url: inputUrl, reason: "That page is too large to check", code: "too_large", status: res.status };
      return { ok: true, url: inputUrl, finalUrl: url.toString(), status: res.status, contentType, body, bytes: Buffer.byteLength(body) };
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return aborted
        ? { ok: false, url: inputUrl, reason: "The site took too long to respond", code: "timeout" }
        : { ok: false, url: inputUrl, reason: "We could not read the page", code: "network_error" };
    }
  }
  return { ok: false, url: inputUrl, reason: "The site redirected too many times", code: "too_many_redirects" };
}

async function readLimited(res: Response, max: number): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Minimal robots.txt support: Disallow rules for our agent or "*", with "$" and "*" wildcards. */
export class RobotsRules {
  private disallow: RegExp[] = [];
  private allow: RegExp[] = [];

  static parse(text: string, agentToken = "aivisibilitycheck"): RobotsRules {
    const rules = new RobotsRules();
    let applies = false;
    let sawSpecific = false;
    const groups: Array<{ agents: string[]; lines: string[] }> = [];
    let currentGroup: { agents: string[]; lines: string[] } | null = null;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === "user-agent") {
        if (!currentGroup || currentGroup.lines.length > 0) {
          currentGroup = { agents: [], lines: [] };
          groups.push(currentGroup);
        }
        currentGroup.agents.push(value.toLowerCase());
      } else if (currentGroup && (key === "allow" || key === "disallow")) {
        currentGroup.lines.push(`${key}:${value}`);
      }
    }
    const specific = groups.filter((g) => g.agents.some((a) => a.includes(agentToken)));
    const generic = groups.filter((g) => g.agents.includes("*"));
    const chosen = specific.length ? specific : generic;
    sawSpecific = specific.length > 0;
    applies = chosen.length > 0;
    if (!applies) return rules;
    for (const g of chosen) {
      for (const l of g.lines) {
        const [k, v] = [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1)];
        if (!v) continue;
        const re = RobotsRules.toRegex(v);
        if (k === "disallow") rules.disallow.push(re);
        else rules.allow.push(re);
      }
    }
    void sawSpecific;
    return rules;
  }

  private static toRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}`);
  }

  isAllowed(path: string): boolean {
    const allowed = this.allow.some((re) => re.test(path));
    const disallowed = this.disallow.some((re) => re.test(path));
    if (disallowed && !allowed) return false;
    return true;
  }
}

export async function loadRobots(siteUrl: string, deps: FetchDeps = {}): Promise<RobotsRules | null> {
  const check = parsePublicHttpUrl(siteUrl);
  if (!check.ok) return null;
  const robotsUrl = new URL("/robots.txt", check.url).toString();
  const res = await safeFetch(robotsUrl, { ...deps, robots: null });
  if (!res.ok) return null;
  if (!res.contentType.includes("text/plain") && !res.body.toLowerCase().includes("user-agent")) return null;
  return RobotsRules.parse(res.body);
}
