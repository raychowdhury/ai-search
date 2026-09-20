import { isIP } from "node:net";

// Blocked hostname suffixes that never resolve to public services.
const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".home", ".lan", ".corp", ".intranet"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "instance-data"]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^[0-9]{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function inCidr4(ip: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base);
  if (b === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((ip & mask) >>> 0) === ((b & mask) >>> 0);
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
];

function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  let v4Tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    v4Tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff];
    s = s.slice(0, lastColon + 1) + "0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 && head.length !== 8) return null;
  if (missing < 0) return null;
  const all = [...head, ...(halves.length === 2 ? new Array(missing).fill("0") : []), ...rest];
  const nums = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  if (nums.some((n) => Number.isNaN(n)) || nums.length !== 8) return null;
  if (v4Tail.length) {
    nums[6] = v4Tail[0];
    nums[7] = v4Tail[1];
  }
  return nums;
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    return PRIVATE_V4.some(([base, bits]) => inCidr4(n, base, bits));
  }
  if (kind === 6) {
    const h = expandIpv6(ip);
    if (!h) return true;
    if (h.every((x) => x === 0)) return true; // ::
    if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1
    if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff) {
      const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
      return isPrivateIp(v4);
    }
    if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (h[0] === 0x2001 && h[1] === 0x0db8) return true; // documentation
    if (h[0] === 0x0064 && h[1] === 0xff9b) return true; // NAT64 prefix
    return false;
  }
  return true;
}

export type UrlCheck = { ok: true; url: URL; hostname: string } | { ok: false; reason: string };

/**
 * Validates a user-supplied website address as a public http(s) URL.
 * Does not resolve DNS; the crawler re-checks resolved addresses at connect time.
 */
export function parsePublicHttpUrl(input: string): UrlCheck {
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "Please enter a full web address, like https://example.com" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Web addresses must start with http:// or https://" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Web addresses cannot include a username or password" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return { ok: false, reason: "Please enter a full web address, like https://example.com" };
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "That address points to a private or internal network" };
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) return { ok: false, reason: "That address points to a private or internal network" };
    return { ok: false, reason: "Please use your website's domain name rather than an IP address" };
  }
  if (!host.includes(".") || host.endsWith(".")) {
    return { ok: false, reason: "Please enter a full web address, like https://example.com" };
  }
  if (!/^[a-z0-9.-]+$/.test(host)) {
    return { ok: false, reason: "That web address contains characters we cannot use" };
  }
  url.hash = "";
  return { ok: true, url, hostname: host };
}

export function registrableDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** True when `candidate` is the owner's domain or a subdomain of it. */
export function isSameSite(candidateHost: string, ownerDomain: string): boolean {
  const c = registrableDomain(candidateHost);
  const o = registrableDomain(ownerDomain);
  return c === o || c.endsWith(`.${o}`);
}
