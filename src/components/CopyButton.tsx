"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  };
  return (
    <button type="button" onClick={copy} className="btn btn-sm absolute right-2 top-2" aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}
    </button>
  );
}
