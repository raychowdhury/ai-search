"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";
const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage may be unavailable (private mode); the attribute still applies for this page.
  }
  for (const cb of listeners) cb();
}

/** Light / Dark / System. A per-browser preference; "System" follows the device setting. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);
  const options: Array<[ThemeChoice, string]> = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex overflow-hidden rounded-md border border-line2 ${compact ? "text-[11px]" : "text-[12px]"}`}>
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => applyTheme(value)}
          className={`${compact ? "min-h-8 px-2" : "min-h-9 px-3"} font-medium ${choice === value ? "bg-ink text-ink-fg" : "m2 bg-bg hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
