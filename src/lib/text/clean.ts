/** True when the string contains ASCII control characters (other than tab/newline). */
export function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127) return true;
  }
  return false;
}
