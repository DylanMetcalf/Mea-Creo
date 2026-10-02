"use client";

import { ArrowRight, CornerDownLeft, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { WORKSPACE_NAV } from "./nav";

interface Command {
  id: string;
  label: string;
  group: "Go to" | "Create" | "Search";
  href: string;
  icon: typeof Search;
  keywords?: string;
}

/**
 * ⌘K / Ctrl+K / "/" command palette: jump to any area, start a common action, or
 * search everything. Fully keyboard driven (↑ ↓ Enter Esc).
 */
export function CommandPalette({ actions }: { actions: [string, string][] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => {
      setQuery("");
      setActive(0);
      setOpen(true);
    };
    window.addEventListener("mc:command", onOpen);
    return () => window.removeEventListener("mc:command", onOpen);
  }, []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const nav = WORKSPACE_NAV.flatMap((g) => g.items).map((i) => ({
      id: i.href,
      label: i.label,
      group: "Go to" as const,
      href: i.href,
      icon: i.icon,
    }));
    const create = actions.map(([href, label]) => ({
      id: href,
      label,
      group: "Create" as const,
      href,
      icon: Plus,
    }));
    const q = query.trim().toLowerCase();
    const match = (c: Command) => !q || c.label.toLowerCase().includes(q);
    const list: Command[] = [...nav.filter(match), ...create.filter(match)];
    if (q)
      list.push({
        id: "search",
        label: `Search everything for "${query.trim()}"`,
        group: "Search",
        href: `/workspace/search?q=${encodeURIComponent(query.trim())}`,
        icon: Search,
      });
    return list;
  }, [actions, query]);

  const go = (c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    router.push(c.href);
  };

  if (!open) return null;
  let lastGroup = "";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
        else if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => Math.min(a + 1, commands.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          go(commands[active]);
        }
      }}
    >
      <button
        type="button"
        aria-label="Close"
        className="bg-night/45 absolute inset-0 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
      />
      <div className="bg-elevated shadow-lifted border-border relative w-full max-w-xl overflow-hidden rounded-2xl border motion-safe:animate-[pop-in_.18s_var(--ease-out)]">
        <div className="border-border/70 flex items-center gap-3 border-b px-4">
          <Search className="text-subtle size-4 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search or jump to…"
            aria-label="Search or jump to"
            aria-controls="command-list"
            aria-activedescendant={commands[active] ? `cmd-${active}` : undefined}
            className="placeholder:text-subtle h-14 flex-1 bg-transparent text-[0.95rem] outline-none"
          />
          <kbd className="label-mono border-border text-subtle rounded border px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <ul id="command-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {commands.length === 0 && (
            <li className="text-muted px-3 py-6 text-center text-sm">Nothing matches.</li>
          )}
          {commands.map((c, i) => {
            const header = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <li key={c.id} role="none">
                {header && <p className="label-mono text-subtle px-3 pt-3 pb-1.5">{c.group}</p>}
                <button
                  type="button"
                  role="option"
                  id={`cmd-${i}`}
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(c)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === active ? "bg-brand-50 text-brand-900" : "text-ink-soft",
                  )}
                >
                  <c.icon
                    className={cn("size-4", i === active ? "text-brand-600" : "text-subtle")}
                    aria-hidden
                  />
                  <span className="flex-1">{c.label}</span>
                  {i === active ? (
                    <CornerDownLeft className="text-brand-600 size-3.5" aria-hidden />
                  ) : (
                    <ArrowRight className="text-border-strong size-3.5" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-border/70 bg-surface-2 text-subtle flex gap-4 border-t px-4 py-2 text-xs">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}

/** The button in the top bar that opens the palette. */
export function CommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("mc:command"))}
      className="border-border bg-surface-2/80 text-subtle hover:border-border-strong hover:text-ink-soft flex h-9 w-full max-w-sm items-center gap-2.5 rounded-[10px] border px-3 text-sm transition-colors"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">Search or jump to…</span>
      <kbd className="label-mono border-border bg-surface rounded border px-1.5 py-0.5 text-[0.65rem]">
        ⌘K
      </kbd>
    </button>
  );
}
