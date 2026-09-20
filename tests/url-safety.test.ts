import { describe, it, expect } from "vitest";
import { isPrivateIp, parsePublicHttpUrl, isSameSite } from "@/lib/url/safety";

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fd12::1",
    "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2001:db8::1", "64:ff9b::a00:1",
  ])("blocks %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
  it("treats garbage as private", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("parsePublicHttpUrl", () => {
  it("accepts normal sites and adds https", () => {
    const r = parsePublicHttpUrl("example.com/about");
    expect(r.ok && r.url.toString()).toBe("https://example.com/about");
  });
  it.each([
    "ftp://example.com", "http://localhost", "http://127.0.0.1", "http://[::1]/", "http://10.0.0.5",
    "http://foo.local", "http://metadata.google.internal", "http://user:pw@example.com", "http://intranet",
    "http://169.254.169.254/latest/meta-data", "javascript:alert(1)", "http://8.8.8.8",
  ])("rejects %s", (input) => {
    expect(parsePublicHttpUrl(input).ok).toBe(false);
  });
});

describe("isSameSite", () => {
  it("matches domain and subdomains, ignoring www", () => {
    expect(isSameSite("www.example.com", "example.com")).toBe(true);
    expect(isSameSite("blog.example.com", "www.example.com")).toBe(true);
    expect(isSameSite("example.com.evil.net", "example.com")).toBe(false);
    expect(isSameSite("notexample.com", "example.com")).toBe(false);
  });
});
