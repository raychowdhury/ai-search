import { describe, it, expect } from "vitest";
import { safeFetch, RobotsRules, pinnedDispatcher, type Resolver, type PinnedFetch } from "@/lib/crawl/safeFetch";
import { parsePage } from "@/lib/crawl/parse";
import { runAuditRules } from "@/lib/audit/rules";
import { choosePages } from "@/lib/audit/run";

const publicResolver: Resolver = { resolve: async (h) => (h === "private.example" ? ["10.0.0.1"] : ["93.184.216.34"]) };

function fakeFetch(routes: Record<string, { status?: number; headers?: Record<string, string>; body?: string }>, seen: string[] = []): PinnedFetch {
  return async (url, init) => {
    seen.push(init.pinnedAddress);
    const r = routes[url];
    if (!r) return new Response("nope", { status: 404, headers: { "content-type": "text/html" } });
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "content-type": "text/html", ...(r.headers ?? {}) } });
  };
}

describe("safeFetch", () => {
  it("fetches a public page", async () => {
    const res = await safeFetch("https://site.example/", { resolver: publicResolver, fetchImpl: fakeFetch({ "https://site.example/": { body: "<title>Hi</title>" } }) });
    expect(res.ok).toBe(true);
  });
  it("pins the connection to the address that was validated, so a later DNS answer cannot redirect it", async () => {
    let calls = 0;
    const rebinding: Resolver = { resolve: async () => (++calls === 1 ? ["93.184.216.34"] : ["10.0.0.1"]) };
    const seen: string[] = [];
    const res = await safeFetch("https://site.example/", { resolver: rebinding, fetchImpl: fakeFetch({ "https://site.example/": { body: "ok" } }, seen) });
    expect(res.ok).toBe(true);
    expect(seen).toEqual(["93.184.216.34"]);
    expect(calls).toBe(1);
    // Each redirect hop re-validates and re-pins; the second resolve now returns a private address and is refused.
    const seen2: string[] = [];
    let calls2 = 0;
    const flipping: Resolver = { resolve: async () => (++calls2 === 1 ? ["93.184.216.34"] : ["10.0.0.1"]) };
    const hop = await safeFetch("https://site.example/a", { resolver: flipping, fetchImpl: fakeFetch({ "https://site.example/a": { status: 302, headers: { location: "/b" } }, "https://site.example/b": { body: "x" } }, seen2) });
    expect(hop.ok === false && hop.code).toBe("blocked_private_network");
    expect(seen2).toEqual(["93.184.216.34"]);
  });
  it("builds a dispatcher whose lookup returns the pinned address", async () => {
    const d = pinnedDispatcher("93.184.216.34");
    expect(d).toBeDefined();
    await d.close();
  });
  it("blocks hosts that resolve to private addresses", async () => {
    const res = await safeFetch("https://private.example/", { resolver: publicResolver, fetchImpl: fakeFetch({}) });
    expect(res.ok === false && res.code).toBe("blocked_private_network");
  });
  it("blocks redirects into private networks and limits redirect count", async () => {
    const res = await safeFetch("https://site.example/", {
      resolver: publicResolver,
      fetchImpl: fakeFetch({ "https://site.example/": { status: 302, headers: { location: "http://169.254.169.254/latest" } } }),
    });
    expect(res.ok === false && res.code).toBe("invalid_url");
    const loop = await safeFetch("https://site.example/a", {
      resolver: publicResolver,
      fetchImpl: fakeFetch({ "https://site.example/a": { status: 301, headers: { location: "/a" } } }),
    });
    expect(loop.ok === false && loop.code).toBe("too_many_redirects");
  });
  it("rejects non-html and oversized responses", async () => {
    const pdf = await safeFetch("https://site.example/x.pdf", { resolver: publicResolver, fetchImpl: fakeFetch({ "https://site.example/x.pdf": { headers: { "content-type": "application/pdf" } } }) });
    expect(pdf.ok === false && pdf.code).toBe("unsupported_content");
    const big = await safeFetch("https://site.example/big", { resolver: publicResolver, fetchImpl: fakeFetch({ "https://site.example/big": { body: "x".repeat(2 * 1024 * 1024 + 1) } }) });
    expect(big.ok === false && big.code).toBe("too_large");
  });
  it("honours robots disallow", async () => {
    const robots = RobotsRules.parse("User-agent: *\nDisallow: /private\nAllow: /private/ok");
    expect(robots.isAllowed("/private/x")).toBe(false);
    expect(robots.isAllowed("/private/ok")).toBe(true);
    expect(robots.isAllowed("/public")).toBe(true);
    const res = await safeFetch("https://site.example/private/x", { resolver: publicResolver, fetchImpl: fakeFetch({}), robots });
    expect(res.ok === false && res.code).toBe("robots_disallowed");
  });
});

const HOME = `<html><head><title>Riverside Test Dental - Dentist in Testville</title><meta name="description" content="Family dentist in Testville offering teeth cleaning."></head>
<body><h1>Riverside Test Dental</h1><p>Serving Testville, Test State. Call <a href="tel:+15551234567">(555) 123-4567</a>.</p>
<p>123 Main Street, Testville</p><p>Hours: Mon-Fri 8am - 5pm</p><a href="/contact">Contact</a><a href="/services">Services</a>
<script type="application/ld+json">{"@type":"Dentist","name":"Riverside Test Dental","address":"123 Main St","telephone":"555"}</script>
<script>ignored()</script></body></html>`;

describe("parsePage and audit rules", () => {
  it("parses untrusted html into data", () => {
    const p = parsePage("https://riverside-test-dental.example/", HOME);
    expect(p.title).toContain("Riverside");
    expect(p.telLinks).toEqual(["+15551234567"]);
    expect(p.jsonLd.length).toBe(1);
    expect(p.text).not.toContain("ignored()");
    expect(p.links).toContain("https://riverside-test-dental.example/contact");
  });
  it("produces good findings for a complete site and missing findings for a bare one", () => {
    const ctx = { name: "Riverside Test Dental", aliases: [], city: "Testville", region: "Test State", services: ["teeth cleaning"], websiteUrl: "https://riverside-test-dental.example/" };
    const good = runAuditRules(ctx, [parsePage("https://riverside-test-dental.example/", HOME)]);
    const byId = Object.fromEntries(good.map((f) => [f.ruleId, f.severity]));
    expect(byId["contact.phone"]).toBe("good");
    expect(byId["location.address"]).toBe("good");
    expect(byId["location.city"]).toBe("good");
    expect(byId["location.hours"]).toBe("good");
    expect(byId["services.named"]).toBe("good");
    expect(byId["technical.schema"]).toBe("good");
    expect(byId["technical.name"]).toBe("good");
    expect(byId["contact.page"]).toBe("warn");

    const bare = runAuditRules(ctx, [parsePage("https://riverside-test-dental.example/", "<html><body><p>Welcome</p></body></html>")]);
    const bareById = Object.fromEntries(bare.map((f) => [f.ruleId, f.severity]));
    expect(bareById["contact.phone"]).toBe("missing");
    expect(bareById["location.city"]).toBe("missing");
    expect(bareById["services.named"]).toBe("missing");
    expect(bareById["technical.schema"]).toBe("missing");
    expect(bareById["technical.title"]).toBe("missing");
  });
  it("chooses same-site pages only, capped", () => {
    const home = parsePage("https://site.example/", `<a href="/contact">c</a><a href="https://evil.net/contact">x</a><a href="/blog/post">p</a>`);
    const pages = choosePages("https://site.example/", home, "site.example");
    expect(pages).toContain("https://site.example/contact");
    expect(pages.some((p) => p.includes("evil.net"))).toBe(false);
    expect(pages.length).toBeLessThanOrEqual(12);
  });
});
