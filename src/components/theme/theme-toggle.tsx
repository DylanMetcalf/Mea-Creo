"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";

export type ThemeChoice = "light" | "dark" | "system";
const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const LABEL: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };
const ICON = { light: Sun, dark: Moon, system: Monitor };

function current(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || t === "system" ? t : "light";
}

export function setTheme(t: ThemeChoice) {
  document.documentElement.dataset.theme = t;
  document.cookie = `mc_theme=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event("mc:theme"));
}

function subscribe(cb: () => void) {
  window.addEventListener("mc:theme", cb);
  return () => window.removeEventListener("mc:theme", cb);
}

/**
 * Light (default), Dark or System. `compact` is one button that cycles; the full version is
 * a three-way switch. The choice is stored in a first-party cookie and applied before paint.
 */
export function ThemeToggle({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as ThemeChoice);
  const choose = (t: ThemeChoice) => setTheme(t);
  if (compact) {
    const Icon = ICON[theme];
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    return (
      <button
        type="button"
        onClick={() => choose(next)}
        aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
        title={`Theme: ${LABEL[theme]}`}
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-colors",
          inverse
            ? "text-night-muted hover:bg-white/10 hover:text-white"
            : "text-ink-soft hover:bg-surface hover:text-ink",
          className,
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </button>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex rounded-full p-0.5",
        inverse ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-surface-2 ring-border ring-1",
        className,
      )}
    >
      {ORDER.map((t) => {
        const Icon = ICON[t];
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={LABEL[t]}
            title={LABEL[t]}
            onClick={() => choose(t)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors",
              active
                ? inverse
                  ? "bg-white/15 text-white"
                  : "bg-surface text-ink shadow-card"
                : inverse
                  ? "text-night-muted hover:text-white"
                  : "text-subtle hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
