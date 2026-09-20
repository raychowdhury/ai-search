/**
 * Locates a claimed evidence excerpt inside the answer text. Returns null when the
 * excerpt is not actually present, which means the claim must be discarded.
 */
export function locateExcerpt(answer: string, excerpt: string): { start: number; end: number; text: string } | null {
  const needle = excerpt.trim();
  if (needle.length < 3) return null;
  let idx = answer.indexOf(needle);
  if (idx === -1) {
    idx = answer.toLowerCase().indexOf(needle.toLowerCase());
  }
  if (idx === -1) {
    // Tolerate whitespace differences only.
    const collapsedNeedle = needle.replace(/\s+/g, " ");
    const re = new RegExp(collapsedNeedle.split(" ").map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
    const m = re.exec(answer);
    if (!m || m.index === undefined) return null;
    return { start: m.index, end: m.index + m[0].length, text: m[0] };
  }
  return { start: idx, end: idx + needle.length, text: answer.slice(idx, idx + needle.length) };
}
