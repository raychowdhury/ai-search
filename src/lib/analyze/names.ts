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
  // Drop overlapping matches (alias contained in the full name).
  const merged: NameMatch[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) continue;
    merged.push(m);
  }
  return merged;
}

const RECOMMEND_CUES =
  /\b(recommend(?:ed|s|ation)?|suggest(?:ed|s)?|best|top(?:-rated| choice| pick)?|go with|start with|try|great choice|solid choice|highly rated|well[- ]reviewed|first choice)\b/i;

/**
 * Heuristic used only when no extraction model is available: a mention counts as
 * an explicit recommendation when it sits in a list item or near a recommending cue.
 */
export function looksRecommended(answer: string, match: NameMatch): boolean {
  const lineStart = answer.lastIndexOf("\n", match.start) + 1;
  const nl = answer.indexOf("\n", match.end);
  const lineEnd = nl === -1 ? answer.length : nl;
  const line = answer.slice(lineStart, lineEnd);
  if (/^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(line)) return true;
  // Only look within the same sentence so cues from neighbouring sentences do not leak in.
  let sStart = match.start;
  while (sStart > lineStart && !/[.!?]/.test(answer[sStart - 1])) sStart--;
  let sEnd = match.end;
  while (sEnd < lineEnd && !/[.!?]/.test(answer[sEnd])) sEnd++;
  const before = answer.slice(Math.max(sStart, match.start - 120), match.start);
  const after = answer.slice(match.end, Math.min(sEnd, match.end + 120));
  return RECOMMEND_CUES.test(before) || RECOMMEND_CUES.test(after);
}

/** Returns the smallest sentence-ish window around a match for use as evidence. */
export function evidenceWindow(answer: string, match: NameMatch, maxLen = 220): { text: string; start: number; end: number } {
  let start = match.start;
  let end = match.end;
  while (start > 0 && match.start - start < maxLen / 2 && !/[\n.!?]/.test(answer[start - 1])) start--;
  while (end < answer.length && end - match.end < maxLen / 2 && !/[\n.!?]/.test(answer[end])) end++;
  if (end < answer.length && /[.!?]/.test(answer[end])) end++;
  // Keep offsets aligned with the trimmed text so slice(start, end) === text.
  while (start < match.start && /\s/.test(answer[start])) start++;
  while (end > match.end && /\s/.test(answer[end - 1])) end--;
  return { text: answer.slice(start, end), start, end };
}
