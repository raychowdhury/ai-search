const SUFFIXES = new Set(["llc", "inc", "co", "ltd", "corp", "corporation", "company", "pllc", "pc", "plc"]);

/** Lowercases, maps & to and, strips punctuation, leading "the", and corporate suffixes. */
export function normalizeName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && tokens[0] === "the") tokens.shift();
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

export interface NameMatch {
  start: number;
  end: number;
  text: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds a tolerant regex for a business name (case, punctuation, and & vs and). */
export function nameRegex(name: string): RegExp | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const tokens = normalized.split(" ").map((t) => (t === "and" ? "(?:and|&)" : escapeRe(t)));
  const body = tokens.join("[\\s\\-.,'’]+");
  return new RegExp(`(?<![a-z0-9])(?:the\\s+)?${body}(?![a-z0-9])`, "gi");
}

/** Finds every occurrence of any of the given names in the answer text. */
export function findNameMatches(answer: string, names: string[]): NameMatch[] {
  const out: NameMatch[] = [];
  for (const name of names) {
    const re = nameRegex(name);
    if (!re) continue;
    for (const m of answer.matchAll(re)) {
      if (m.index === undefined) continue;
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  out.sort((a, b) => a.start - b.start);
  const merged: NameMatch[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) continue;
    merged.push(m);
  }
  return merged;
}

export type Stance = "positive" | "negative" | "neutral" | "unknown";

const RECOMMEND_CUES =
  /\b(recommend(?:ed|s|ation)?|suggest(?:ed|s)?|best|top(?:-rated| choice| pick)?|go with|start with|try|great choice|solid choice|highly rated|well[- ]reviewed|first choice|worth (?:a look|considering|calling))\b/i;
const NEGATIVE_CUES =
  /\b(avoid|steer clear|not recommend(?:ed)?|don'?t recommend|wouldn'?t recommend|do not recommend|poor(?:ly)?|complaints?|warning|beware|worst|scam|unreliable|mixed reviews|negative reviews|bad reviews|closed(?: down| permanently)?|no longer)\b/i;

function sentenceAround(answer: string, match: NameMatch): { before: string; after: string; line: string } {
  const lineStart = answer.lastIndexOf("\n", match.start) + 1;
  const nl = answer.indexOf("\n", match.end);
  const lineEnd = nl === -1 ? answer.length : nl;
  let sStart = match.start;
  while (sStart > lineStart && !/[.!?]/.test(answer[sStart - 1])) sStart--;
  let sEnd = match.end;
  while (sEnd < lineEnd && !/[.!?]/.test(answer[sEnd])) sEnd++;
  return {
    before: answer.slice(Math.max(sStart, match.start - 120), match.start),
    after: answer.slice(match.end, Math.min(sEnd, match.end + 120)),
    line: answer.slice(lineStart, lineEnd),
  };
}

/**
 * Heuristic stance used only when no extraction model is available. Negative cues
 * in the same sentence or list item win over list placement, so "- Avoid Acme" is
 * negative, not a recommendation. Absence of any cue is neutral, never positive.
 */
export function assessStance(answer: string, match: NameMatch): Stance {
  const { before, after, line } = sentenceAround(answer, match);
  const sentence = before + match.text + after;
  if (NEGATIVE_CUES.test(sentence) || NEGATIVE_CUES.test(line.slice(0, Math.min(line.length, 40)))) return "negative";
  if (RECOMMEND_CUES.test(before) || RECOMMEND_CUES.test(after)) return "positive";
  if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) return "positive";
  return "neutral";
}

/** Backwards-compatible boolean view of assessStance. */
export function looksRecommended(answer: string, match: NameMatch): boolean {
  return assessStance(answer, match) === "positive";
}

/** Returns the smallest sentence-ish window around a match for use as evidence. */
export function evidenceWindow(answer: string, match: NameMatch, maxLen = 220): { text: string; start: number; end: number } {
  let start = match.start;
  let end = match.end;
  while (start > 0 && match.start - start < maxLen / 2 && !/[\n.!?]/.test(answer[start - 1])) start--;
  while (end < answer.length && end - match.end < maxLen / 2 && !/[\n.!?]/.test(answer[end])) end++;
  if (end < answer.length && /[.!?]/.test(answer[end])) end++;
  while (start < match.start && /\s/.test(answer[start])) start++;
  while (end > match.end && /\s/.test(answer[end - 1])) end--;
  return { text: answer.slice(start, end), start, end };
}
