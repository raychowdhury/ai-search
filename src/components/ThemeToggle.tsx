"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "./icons";

export type ThemeChoice = "light" | "dark";
const KEY = "theme";
const listeners = new Set<() => void>();
const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark" };
const ICON: Record<ThemeChoice, React.ReactNode> = { light: <IconSun />, dark: <IconMoon /> };

/** The theme in effect: the saved choice, else the device setting. */
function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // fall through to the device setting
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
    media.removeEventListener("change", cb);
  };
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage may be unavailable (private mode); the attribute still applies for this page.
  }
  for (const cb of listeners) cb();
}

function useChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "light" as ThemeChoice);
}

/**
 * Light or dark. "icon": one button showing the current theme (sun or moon) that
 * flips it. "segmented": icon + word per option. Saved per browser.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "segmented" }) {
  const choice = useChoice();
  const next: ThemeChoice = choice === "dark" ? "light" : "dark";
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={`Switch to ${LABEL[next].toLowerCase()} mode`}
        title={`Switch to ${LABEL[next].toLowerCase()} mode`}
        className="ico h-9 w-9 cursor-pointer rounded-md hover:text-fg"
      >
        {ICON[choice]}
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex overflow-hidden rounded-md border border-line2 text-[12px]">
      {(["light", "dark"] as ThemeChoice[]).map((value) => (
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
