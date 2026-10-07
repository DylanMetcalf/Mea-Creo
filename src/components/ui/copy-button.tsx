"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "./cn";

/** Copies text to the clipboard and confirms; falls back to selecting a prompt. */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          window.prompt("Copy this link:", value);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
      className={cn(
        "border-border bg-surface hover:border-brand-300 inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
        className,
      )}
    >
      {done ? (
        <Check className="text-success-700 size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
