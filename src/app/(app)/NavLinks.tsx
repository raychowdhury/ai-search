"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconCheck, IconClock, IconGear, IconGrid } from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: <IconGrid /> },
  { href: "/actions", label: "Actions", icon: <IconCheck /> },
  { href: "/history", label: "History", icon: <IconClock /> },
  { href: "/questions", label: "Questions", icon: <IconChat /> },
  { href: "/settings", label: "Settings", icon: <IconGear /> },
];

export function NavLinks({ variant }: { variant: "side" | "tab" }) {
  const pathname = usePathname();
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/dashboard" && pathname.startsWith("/report"));
  return (
    <>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isOn(n.href) ? "page" : undefined} className={`${variant === "side" ? "navl" : "tab"} ${isOn(n.href) ? "on" : ""}`}>
          {n.icon}
          {n.label}
        </Link>
      ))}
    </>
  );
}
