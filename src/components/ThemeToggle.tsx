"use client";

import { useSyncExternalStore } from "react";
import { IconMonitor, IconMoon, IconSun } from "./icons";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "theme";
const listeners = new Set<() => void>();
const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };
const ICON: Record<ThemeChoice, React.ReactNode> = { light: <IconSun />, dark: <IconMoon />, system: <IconMonitor /> };

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

function useChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);
}

/**
 * Appearance control. "icon": one button showing the current choice (sun, moon,
 * monitor) that cycles Light → Dark → System. "segmented": icon + word per option.
 * A per-browser preference; System follows the device setting.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "segmented" }) {
  const choice = useChoice();
  if (variant === "icon") {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    return (
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={`Appearance: ${LABEL[choice]}. Switch to ${LABEL[next]}.`}
        title={`Appearance: ${LABEL[choice]} (click for ${LABEL[next]})`}
        className="ico h-9 w-9 cursor-pointer rounded-md hover:text-fg"
      >
        {ICON[choice]}
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex overflow-hidden rounded-md border border-line2 text-[12px]">
      {ORDER.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => applyTheme(value)}
          className={`row min-h-9 gap-1.5 px-3 font-medium ${choice === value ? "bg-ink text-ink-fg" : "m2 bg-bg hover:text-fg"}`}
        >
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{ICON[value]}</span>
          {LABEL[value]}
        </button>
      ))}
    </div>
  );
}
