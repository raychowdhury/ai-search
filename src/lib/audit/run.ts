import type { Db } from "@/db/client";
import { newId, nowIso } from "@/lib/ids";
import type { Business } from "@/lib/business/schema";
import { safeFetch, loadRobots, type FetchDeps } from "@/lib/crawl/safeFetch";
import { parsePage, type ParsedPage } from "@/lib/crawl/parse";
import { isSameSite } from "@/lib/url/safety";
import { runAuditRules, type Finding } from "./rules";

export const MAX_PAGES = 12;
const LIKELY_PATHS = ["/contact", "/contact-us", "/about", "/about-us", "/services", "/service", "/locations", "/hours", "/pricing", "/menu"];

export interface PageStatus {
  url: string;
  fetched: boolean;
  status?: number;
  bytes?: number;
  error?: string;
  code?: string;
}

export interface AuditResult {
  auditId: string;
  status: "complete" | "failed_fetch";
  pages: PageStatus[];
  findings: Finding[];
}

/** Picks likely pages: homepage, common paths, and same-site links whose path looks relevant. */
export function choosePages(homeUrl: string, home: ParsedPage | null, domain: string): string[] {
  const base = new URL(homeUrl);
  const out = new Set<string>([base.toString()]);
  for (const p of LIKELY_PATHS) out.add(new URL(p, base).toString());
  if (home) {
    for (const link of home.links) {
      let u: URL;
      try {
        u = new URL(link);
      } catch {
        continue;
      }
      if (u.protocol !== base.protocol && u.protocol !== "https:") continue;
      if (!isSameSite(u.hostname, domain)) continue;
      if (/contact|about|service|location|hours|pricing|menu|team|faq/i.test(u.pathname)) {
        u.hash = "";
        u.search = "";
        out.add(u.toString());
      }
      if (out.size >= MAX_PAGES * 2) break;
    }
  }
  return [...out].slice(0, MAX_PAGES);
}

export async function runWebsiteAudit(db: Db, business: Business, runId: string | null, deps: FetchDeps = {}): Promise<AuditResult> {
  const auditId = newId();
  const ts = nowIso();
  db.prepare(
    "INSERT INTO audits (id, business_id, run_id, status, data_mode, started_at, pages, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(auditId, business.id, runId, "running", "live", ts, "[]", ts, ts);

  const robots = await loadRobots(business.websiteUrl, deps);
  const fetchDeps: FetchDeps = { ...deps, robots };
  const pageStatuses: PageStatus[] = [];
  const parsed: ParsedPage[] = [];

  const homeRes = await safeFetch(business.websiteUrl, fetchDeps);
  if (!homeRes.ok) {
    pageStatuses.push({ url: business.websiteUrl, fetched: false, error: homeRes.reason, code: homeRes.code, status: homeRes.status });
    finish(db, auditId, "failed_fetch", pageStatuses, [], homeRes.reason);
    return { auditId, status: "failed_fetch", pages: pageStatuses, findings: [] };
  }
  const home = parsePage(homeRes.finalUrl, homeRes.body);
  parsed.push(home);
  pageStatuses.push({ url: homeRes.finalUrl, fetched: true, status: homeRes.status, bytes: homeRes.bytes });

  const seen = new Set<string>([normalize(business.websiteUrl), normalize(homeRes.finalUrl)]);
  for (const url of choosePages(homeRes.finalUrl, home, business.websiteDomain)) {
    if (seen.has(normalize(url))) continue;
    seen.add(normalize(url));
    if (parsed.length >= MAX_PAGES) break;
    const res = await safeFetch(url, fetchDeps);
    if (res.ok) {
      parsed.push(parsePage(res.finalUrl, res.body));
      pageStatuses.push({ url, fetched: true, status: res.status, bytes: res.bytes });
    } else if (res.code !== "http_error" || (res.status && res.status !== 404)) {
      pageStatuses.push({ url, fetched: false, error: res.reason, code: res.code, status: res.status });
    }
  }

  const findings = runAuditRules(
    { name: business.name, aliases: business.aliases, city: business.city, region: business.region, services: business.services, websiteUrl: homeRes.finalUrl },
    parsed,
  );
  finish(db, auditId, "complete", pageStatuses, findings, null);
  return { auditId, status: "complete", pages: pageStatuses, findings };
}

function normalize(u: string): string {
  return u.replace(/\/+$/, "").toLowerCase();
}

function finish(db: Db, auditId: string, status: "complete" | "failed_fetch", pages: PageStatus[], findings: Finding[], error: string | null): void {
  const ts = nowIso();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE audits SET status = ?, finished_at = ?, pages = ?, error_message = ?, updated_at = ? WHERE id = ?").run(status, ts, JSON.stringify(pages), error, ts, auditId);
    const insert = db.prepare(
      "INSERT INTO audit_findings (id, audit_id, rule_id, category, severity, title, detail, evidence, page_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    );
    for (const f of findings) {
      insert.run(newId(), auditId, f.ruleId, f.category, f.severity, f.title, f.detail, f.evidence ? JSON.stringify(f.evidence) : null, f.pageUrl ?? null, ts);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export interface StoredAudit {
  id: string;
  businessId: string;
  runId: string | null;
  status: "queued" | "running" | "complete" | "failed_fetch";
  startedAt: string | null;
  finishedAt: string | null;
  pages: PageStatus[];
  errorMessage: string | null;
  findings: Array<Finding & { id: string }>;
}

export function latestAudit(db: Db, businessId: string, runId?: string): StoredAudit | null {
  const row = (
    runId
      ? db.prepare("SELECT * FROM audits WHERE business_id = ? AND run_id = ? ORDER BY created_at DESC LIMIT 1").get(businessId, runId)
      : db.prepare("SELECT * FROM audits WHERE business_id = ? ORDER BY created_at DESC LIMIT 1").get(businessId)
  ) as
    | { id: string; business_id: string; run_id: string | null; status: StoredAudit["status"]; started_at: string | null; finished_at: string | null; pages: string; error_message: string | null }
    | undefined;
  if (!row) return null;
  const findings = (
    db.prepare("SELECT * FROM audit_findings WHERE audit_id = ? ORDER BY created_at, rule_id").all(row.id) as unknown as Array<{
      id: string; rule_id: string; category: Finding["category"]; severity: Finding["severity"]; title: string; detail: string; evidence: string | null; page_url: string | null;
    }>
  ).map((f) => ({
    id: f.id, ruleId: f.rule_id, category: f.category, severity: f.severity, title: f.title, detail: f.detail,
    evidence: f.evidence ? (JSON.parse(f.evidence) as Finding["evidence"]) : undefined, pageUrl: f.page_url ?? undefined,
  }));
  return {
    id: row.id, businessId: row.business_id, runId: row.run_id, status: row.status, startedAt: row.started_at, finishedAt: row.finished_at,
    pages: JSON.parse(row.pages) as PageStatus[], errorMessage: row.error_message, findings,
  };
}
