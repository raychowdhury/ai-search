import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const IconCheck = (p: P) => <svg {...base(p)} strokeWidth={1.8}><path d="M3 8.5l3 3 7-7" /></svg>;
export const IconMinus = (p: P) => <svg {...base(p)} strokeWidth={1.8}><path d="M4 8h8" /></svg>;
export const IconX = (p: P) => <svg {...base(p)} strokeWidth={1.8}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
export const IconWarn = (p: P) => <svg {...base(p)}><path d="M8 2.5l6 11H2z M8 6.5v3M8 11.5v.5" /></svg>;
export const IconCircle = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="6" /></svg>;
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>;
export const IconInfo = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5v.5" /></svg>;
export const IconAlert = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5M8 11v.5" /></svg>;
export const IconDot = (p: P) => <svg viewBox="0 0 16 16" aria-hidden {...p}><circle cx="8" cy="8" r="3" fill="currentColor" /></svg>;
export const IconChevron = (p: P) => <svg {...base(p)}><path d="M6 3l5 5-5 5" /></svg>;
export const IconGrid = (p: P) => <svg {...base(p)} strokeWidth={1.5}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>;
export const IconChat = (p: P) => <svg {...base(p)} strokeWidth={1.5}><path d="M3 3h10v7H7l-3 3v-3H3z" /></svg>;
export const IconGear = (p: P) => <svg {...base(p)} strokeWidth={1.5}><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></svg>;
export const IconSearch = (p: P) => <svg {...base(p)} strokeWidth={1.5}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>;
export const IconPeople = (p: P) => <svg {...base(p)} strokeWidth={1.5}><circle cx="6" cy="5.5" r="2.5" /><circle cx="11.5" cy="6.5" r="2" /><path d="M1.5 13c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M10 9.5c2 0 3.6 1.2 4.3 3.5" /></svg>;
export const IconLines = (p: P) => <svg {...base(p)} strokeWidth={1.5}><path d="M3 4h10M3 8h7M3 12h5" /></svg>;
export const IconArrowUp = (p: P) => <svg {...base(p)}><path d="M8 13V3M4 7l4-4 4 4" /></svg>;
export const IconArrowDown = (p: P) => <svg {...base(p)}><path d="M8 3v10M4 9l4 4 4-4" /></svg>;
export const IconCopy = (p: P) => <svg {...base(p)} strokeWidth={1.5}><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>;
export const IconExternal = (p: P) => <svg {...base(p)} strokeWidth={1.5}><path d="M9 3h4v4M13 3L7 9M11 9v4H3V5h4" /></svg>;
export const IconSun = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg>;
export const IconMoon = (p: P) => <svg {...base(p)}><path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" /></svg>;
export const IconMonitor = (p: P) => <svg {...base(p)}><rect x="2" y="3" width="12" height="8" rx="1.5" /><path d="M6 13.5h4M8 11v2.5" /></svg>;
