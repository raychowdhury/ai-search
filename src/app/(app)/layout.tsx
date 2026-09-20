import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getDb } from "@/db/client";
import { getBusinessForUser } from "@/lib/business/repo";
import { logoutAction } from "@/server/actions/auth";
import { NavLinks } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const business = getBusinessForUser(getDb(), user.id);
  const initial = (business?.name ?? user.email).trim().charAt(0).toUpperCase();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-[224px_1fr]">
      {/* Desktop sidebar (over 1024px) */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col" style={{ padding: "20px 12px", borderRight: "1px solid var(--line)", background: "var(--bg2)", gap: 2 }}>
        <Link href="/dashboard" className="text-fg" style={{ padding: "6px 10px 14px", fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>Mentioned</Link>
        <div className="row mb-3.5 gap-2.5 rounded-lg border border-line bg-bg px-2.5 py-2">
          <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-ink text-xs font-semibold text-ink-fg">{initial}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium" title={business?.name}>{business?.name ?? "Set up your business"}</span>
            <span className="dt text-[11px]">{business ? `${business.city}, ${business.region}` : user.email}</span>
          </span>
        </div>
        <NavLinks variant="side" />
        <div className="rowline mt-3 pt-3">
          <p className="dt truncate px-2.5 pb-1" title={user.email}>{user.email}</p>
          <form action={logoutAction}>
            <button type="submit" className="navl w-full text-left">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Compact top bar (phone and tablet) */}
      <header className="row h-[52px] justify-between border-b border-line px-4 lg:hidden">
        <Link href="/dashboard" className="text-fg font-semibold tracking-tight">Mentioned</Link>
        <form action={logoutAction}><button type="submit" className="m2 flex min-h-11 items-center text-[13px]">Sign out</button></form>
      </header>

      <main className="mx-auto w-full max-w-[1024px] flex-1 px-4 pb-24 pt-5 sm:px-8 lg:pb-10 lg:pt-8">{children}</main>

      {/* Bottom tab bar (phone and tablet) */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-bg lg:hidden">
        <NavLinks variant="tab" />
      </nav>
    </div>
  );
}
