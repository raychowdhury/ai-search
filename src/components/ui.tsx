import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconCircle, IconClock, IconDot, IconInfo, IconMinus, IconWarn, IconX } from "./icons";

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="text-[22px] leading-tight sm:text-2xl">{children}</h1>
      {sub ? <p className="m2 text-[15px] leading-relaxed">{sub}</p> : null}
    </div>
  );
}

export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`k ${className}`}>{children}</h2>;
}

export function Card({ children, className = "", inv = false, sample = false }: { children: ReactNode; className?: string; inv?: boolean; sample?: boolean }) {
  return <section className={`card p-4 sm:p-5 ${inv ? "inv" : ""} ${sample ? "sample" : ""} ${className}`}>{children}</section>;
}

export function CardTitle({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="row mb-3 justify-between">
      <h2 className="k">{children}</h2>
      {icon ? <span className="ico">{icon}</span> : null}
    </div>
  );
}

type NoticeKind = "info" | "warning" | "error" | "success";
const NOTICE_CLASS: Record<NoticeKind, string> = { info: "notice-info", warning: "notice-warn", error: "notice-bad", success: "notice-good" };
const NOTICE_ICON: Record<NoticeKind, ReactNode> = { info: <IconInfo />, warning: <IconWarn />, error: <IconAlert />, success: <IconCheck /> };

export function Notice({ kind = "info", children }: { kind?: NoticeKind; children: ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`notice ${NOTICE_CLASS[kind]}`}>
      {NOTICE_ICON[kind]}
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-10">
      <h2 className="text-[22px]">{title}</h2>
      {children ? <p className="m2 m-0 max-w-md">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function DataModeBadge({ mode }: { mode: "live" | "demo" }) {
  return mode === "demo" ? (
    <span className="chip chip-sample"><IconWarn />Sample data</span>
  ) : (
    <span className="chip chip-good"><IconDot />Live</span>
  );
}

/** Platform label with the "API, not the app" note as a native tooltip. */
export function PlatformBadge({ label }: { label: string }) {
  const short = label.replace(/\s*\(.*\)\s*$/, "");
  return (
    <span className="chip chip-fg" tabIndex={0} title="Collected through this platform's API, which is not identical to its consumer app.">
      {short} <span className="m3">· API</span>
    </span>
  );
}

export type ChipTone = "good" | "warn" | "bad" | "neutral" | "ink" | "sample";
const CHIP_CLASS: Record<ChipTone, string> = { good: "chip-good", warn: "chip-warn", bad: "chip-bad", neutral: "", ink: "chip-ink", sample: "chip-sample" };
const CHIP_ICON: Record<ChipTone, ReactNode> = { good: <IconCheck />, warn: <IconWarn />, bad: <IconX />, neutral: null, ink: null, sample: <IconWarn /> };

/** Status chip. Tone colors are always paired with an icon or word. */
export function Chip({ tone, children, icon, noIcon = false }: { tone: ChipTone; children: ReactNode; icon?: ReactNode; noIcon?: boolean }) {
  return (
    <span className={`chip ${CHIP_CLASS[tone]}`}>
      {noIcon ? null : icon ?? CHIP_ICON[tone]}
      {children}
    </span>
  );
}

export const chipIcons = { minus: <IconMinus />, queued: <IconCircle />, running: <IconClock />, check: <IconCheck />, x: <IconX /> };

/** Renders "Mentioned in 3 of 9 answers". Never renders a bare number without its denominator. */
export function MetricSentence({ label, numerator, denominator, noun = "answers", big = false, percent = false }: { label: string; numerator: number; denominator: number; noun?: string; big?: boolean; percent?: boolean }) {
  if (denominator === 0) {
    return <p className={big ? "m2 text-xl font-semibold tracking-tight" : "m2"}>{label}: no successful {noun} to count</p>;
  }
  const pct = percent ? <span className="m2"> ({Math.round((numerator / denominator) * 100)}%)</span> : null;
  return (
    <p className={big ? "text-[26px] font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]" : ""} style={{ textWrap: "pretty" }}>
      {label} in <span className="tabular-nums">{numerator}</span> of <span className="tabular-nums">{denominator}</span> {noun}{pct}
    </p>
  );
}

export function CompetitorBar({ name, count, total, you = false, wide = false }: { name: ReactNode; count: number; total: number; you?: boolean; wide?: boolean }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="row gap-2 text-[13px]">
      <span className={`${wide ? "w-[180px]" : "w-[140px]"} shrink-0 overflow-hidden text-ellipsis whitespace-nowrap`}>{name}</span>
      <span className={`bar ${you ? "you" : ""}`} aria-hidden><i style={{ width: `${pct}%` }} /></span>
      <span className="m2 w-14 shrink-0 text-right tabular-nums whitespace-nowrap">{count} of {total}</span>
    </div>
  );
}

export function Button({ children, variant = "primary", size, className = "", ...rest }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = { primary: "btn-primary", secondary: "", ghost: "btn-ghost", danger: "btn-danger" }[variant];
  return (
    <button {...rest} className={`btn ${v} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size, className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm"; className?: string }) {
  const v = { primary: "btn-primary", secondary: "", ghost: "btn-ghost" }[variant];
  return (
    <Link href={href} className={`btn ${v} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field mb-4">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error ? <span id={`${name}-hint`} className="dt font-normal">{hint}</span> : null}
      {error ? <span id={`${name}-error`} className="dt font-normal" style={{ color: "var(--bad)" }}>{error}</span> : null}
    </div>
  );
}

export const inputClass = "input";

export function Skeleton({ w = "100%", h = 12, className = "" }: { w?: string; h?: number; className?: string }) {
  return <div className={`sk ${className}`} style={{ width: w, height: h }} aria-hidden />;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}
