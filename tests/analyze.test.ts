import { describe, it, expect } from "vitest";
import { normalizeName, findNameMatches, assessStance, looksRecommended, evidenceWindow } from "@/lib/analyze/names";
import { locateExcerpt } from "@/lib/analyze/verify";
import { verifyExtraction } from "@/lib/analyze/extract";
import { normalizeCitations } from "@/lib/analyze/citations";
import { computeRunMetrics } from "@/lib/metrics/compute";
import type { Check } from "@/lib/collect/runs";
import type { MentionRecord, CitationRecord } from "@/lib/analyze/store";

describe("normalizeName", () => {
  it("handles case, punctuation, &, the, and suffixes", () => {
    expect(normalizeName("The Riverside Dental & Ortho, LLC")).toBe("riverside dental and ortho");
    expect(normalizeName("Bob's Auto Repair Inc.")).toBe("bob s auto repair");
  });
});

describe("findNameMatches", () => {
  const answer = "1. Riverside Dental & Ortho - great. Also try riverside dental and ortho's weekend hours. Not Riverside Dentalworks.";
  it("finds tolerant matches and ignores partial words", () => {
    const m = findNameMatches(answer, ["Riverside Dental & Ortho"]);
    expect(m.length).toBe(2);
    expect(m[0].text).toBe("Riverside Dental & Ortho");
  });
  it("does not match when absent", () => {
    expect(findNameMatches("Nothing here.", ["Riverside Dental"])).toEqual([]);
  });
  it("de-duplicates overlapping alias matches", () => {
    const m = findNameMatches("Go to Riverside Dental Group today.", ["Riverside Dental Group", "Riverside Dental"]);
    expect(m.length).toBe(1);
  });
});

describe("assessStance (fallback heuristic)", () => {
  it("treats list items and cue words as positive, negation as negative, plain mention as neutral", () => {
    const a = "Options:\n- Acme Plumbing: fast.\nAcme Plumbing also exists. I recommend Acme Plumbing.";
    const ms = findNameMatches(a, ["Acme Plumbing"]);
    expect(assessStance(a, ms[0])).toBe("positive");
    expect(assessStance(a, ms[1])).toBe("neutral");
    expect(assessStance(a, ms[2])).toBe("positive");
    expect(looksRecommended(a, ms[1])).toBe(false);
    expect(evidenceWindow(a, ms[2]).text).toBe("I recommend Acme Plumbing.");
  });
  it("does not count a negative list item as a recommendation", () => {
    const a = "Some notes:\n- Avoid Acme Plumbing; several complaints.\n- Try Bright Pipes instead.";
    const [acme] = findNameMatches(a, ["Acme Plumbing"]);
    const [bright] = findNameMatches(a, ["Bright Pipes"]);
    expect(assessStance(a, acme)).toBe("negative");
    expect(looksRecommended(a, acme)).toBe(false);
    expect(assessStance(a, bright)).toBe("positive");
  });
  it("marks a heading-only or url-only mention as neutral", () => {
    const a = "See https://acme-plumbing.example/services for details.";
    const m = findNameMatches(a, ["Acme Plumbing"]);
    expect(m.length).toBe(1);
    expect(assessStance(a, m[0])).toBe("neutral");
  });
});

describe("locateExcerpt and verifyExtraction", () => {
  const answer = "Try Northside Plumbing Co. for repairs.\nBright Pipes Group is also good.\nBest options are listed below.";
  it("locates exact and whitespace-tolerant excerpts, rejects fabricated ones", () => {
    expect(locateExcerpt(answer, "Bright Pipes Group is also good.")?.start).toBe(40);
    expect(locateExcerpt(answer, "bright   pipes group is also good")).not.toBeNull();
    expect(locateExcerpt(answer, "Totally made up sentence.")).toBeNull();
  });
  it("drops entities whose full name is not inside their evidence span", () => {
    const verified = verifyExtraction(answer, {
      businesses: [
        { name: "Northside Plumbing", stance: "positive", evidence: "Try Northside Plumbing Co. for repairs." },
        { name: "Fake Plumbing", stance: "positive", evidence: "Fake Plumbing is the best." },
        { name: "Bright Pipes Group", stance: "neutral", evidence: "Not in the text at all" },
        // Reproduction from the review: first-token overlap must not pass.
        { name: "Best Imaginary Plumbing", stance: "positive", evidence: "Best options are listed below." },
        // Name present in the answer but the evidence names someone else.
        { name: "Bright Pipes Group", stance: "positive", evidence: "Try Northside Plumbing Co. for repairs." },
      ],
    });
    expect(verified.map((v) => v.name)).toEqual(["Northside Plumbing"]);
    expect(verified[0].stance).toBe("positive");
  });
});

describe("normalizeCitations", () => {
  it("dedupes, strips www, flags owner domain, drops bad urls", () => {
    const out = normalizeCitations(
      [
        { url: "https://www.example.com/a#x", title: "A" },
        { url: "https://www.example.com/a" },
        { url: "https://blog.example.com/p" },
        { url: "https://other.net/" },
        { url: "javascript:alert(1)" },
      ],
      "example.com",
    );
    expect(out.length).toBe(3);
    expect(out.filter((c) => c.isOwnerDomain).length).toBe(2);
    expect(out[0].domain).toBe("example.com");
  });
});

export const check = (id: string, status: Check["status"], platform: Check["platform"] = "demo", extra: Partial<Check> = {}): Check => ({
  id, runId: "r", questionId: `q${id}`, questionText: `Q ${id}`, platform, model: null,
  locationContext: { city: "X", region: "Y", country: "US" }, status, errorCode: status === "failed" ? "boom" : null,
  errorMessage: null, attempts: 1, requestedAt: null, completedAt: null, answerText: status === "success" ? "text" : null,
  usage: null, dataMode: "demo", evidenceStatus: "full", analysisMethod: "demo", analysisNote: null, ...extra,
});
export const mention = (checkId: string, name: string, isOwner: boolean, stance: MentionRecord["stance"]): MentionRecord => ({
  id: `${checkId}-${name}-${stance}`, checkId, name, normalizedName: name.toLowerCase(), isOwner, isRecommended: stance === "positive", stance,
  evidenceText: name, evidenceStart: 0, evidenceEnd: 1, extractionMethod: "demo",
});
export const citation = (checkId: string, domain: string, owner: boolean): CitationRecord => ({
  id: `${checkId}-${domain}`, checkId, url: `https://${domain}/`, domain, title: null, isOwnerDomain: owner, position: 1,
});

describe("computeRunMetrics", () => {
  it("excludes failed checks from denominators and counts competitors per check", () => {
    const checks = [check("1", "success"), check("2", "success"), check("3", "failed"), check("4", "queued")];
    const mentions = [
      mention("1", "Owner", true, "positive"), mention("1", "Comp A", false, "positive"), mention("1", "Comp A", false, "neutral"),
      mention("2", "Comp A", false, "neutral"), mention("2", "Comp B", false, "positive"),
    ];
    const citations = [citation("1", "owner.example", true), citation("2", "dir.example", false)];
    const m = computeRunMetrics(checks, mentions, citations);
    expect(m.successfulChecks).toBe(2);
    expect(m.failedChecks).toBe(1);
    expect(m.pendingChecks).toBe(1);
    expect(m.mentionRate).toEqual({ numerator: 1, denominator: 2 });
    expect(m.recommendationRate).toEqual({ numerator: 1, denominator: 2 });
    expect(m.citationRate).toEqual({ numerator: 1, denominator: 2 });
    expect(m.competitors[0]).toMatchObject({ name: "Comp A", mentioned: 2, recommended: 1 });
    expect(m.competitors[1]).toMatchObject({ name: "Comp B", mentioned: 1, recommended: 1 });
    expect(m.topDomains.map((d) => d.domain)).toEqual(["dir.example", "owner.example"]);
    expect(m.questions.find((q) => q.checkId === "3")?.status).toBe("failed");
  });

  it("a negative owner mention counts as mentioned but not recommended", () => {
    const m = computeRunMetrics([check("1", "success")], [mention("1", "Owner", true, "negative")], []);
    expect(m.mentionRate).toEqual({ numerator: 1, denominator: 1 });
    expect(m.recommendationRate).toEqual({ numerator: 0, denominator: 1 });
  });

  it("leaves unreadable evidence out of the citation denominator and reports extraction gaps", () => {
    const checks = [check("1", "success"), check("2", "success", "demo", { evidenceStatus: "unparseable", analysisMethod: "failed" })];
    const m = computeRunMetrics(checks, [], [citation("1", "owner.example", true)]);
    expect(m.citationRate).toEqual({ numerator: 1, denominator: 1 });
    expect(m.mentionRate.denominator).toBe(2);
    expect(m.evidenceUnreadable).toBe(1);
    expect(m.extractionUnavailable).toBe(1);
  });

  it("shows zero denominators when nothing succeeded", () => {
    const m = computeRunMetrics([check("1", "failed")], [], []);
    expect(m.mentionRate).toEqual({ numerator: 0, denominator: 0 });
    expect(m.competitors).toEqual([]);
  });
});
