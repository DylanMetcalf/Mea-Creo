"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

export interface SwitcherWorkspace {
  organisationId: string;
  name: string;
  hasLogo: boolean;
  isInternal: boolean;
}

function Mark({ w }: { w: SwitcherWorkspace }) {
  if (w.isInternal)
    return (
      <span className="bg-signal/15 flex size-7 shrink-0 items-center justify-center rounded-lg">
        <span className="bg-signal size-2 rounded-full shadow-[0_0_10px_rgb(127_224_178/0.9)]" />
      </span>
    );
  if (w.hasLogo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route
      <img
        src={`/api/logos/${w.organisationId}`}
        alt=""
        className="size-7 shrink-0 rounded-lg bg-white object-contain p-0.5"
      />
    );
  return (
    <span className="text-night-text flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[0.65rem] font-semibold">
      {w.name
        .replace(/\(.*?\)/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

/**
 * Switch between Mea Creo HQ and each client's workspace. The current one follows the URL,
 * so opening a client from anywhere updates it.
 */
export function WorkspaceSwitcher({ workspaces }: { workspaces: SwitcherWorkspace[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState(pathname);
  if (last !== pathname) {
    setLast(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const match = pathname.match(/^\/workspace\/clients\/([0-9a-f-]{36})/);
  const hq = workspaces.find((w) => w.isInternal);
  const current = (match && workspaces.find((w) => w.organisationId === match[1])) || hq;
  const list = workspaces.filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase()));
  const href = (w: SwitcherWorkspace) =>
    w.isInternal ? "/workspace" : `/workspace/clients/${w.organisationId}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-night-line flex w-full items-center gap-2.5 rounded-xl border bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        {current && <Mark w={current} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">
            {current?.isInternal ? "Mea Creo HQ" : current?.name}
          </span>
          <span className="text-night-muted block text-xs">
            {current?.isInternal ? "Your workspace" : "Client workspace"}
          </span>
        </span>
        <ChevronsUpDown className="text-night-muted size-4" aria-hidden />
      </button>
      {open && (
        <div className="border-night-line bg-night-2 absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-xl border shadow-[0_20px_50px_-15px_rgb(0_0_0/0.7)] motion-safe:animate-[pop-in_.15s_var(--ease-out)]">
          {workspaces.length > 6 && (
            <div className="border-night-line flex items-center gap-2 border-b px-3">
              <Search className="text-night-muted size-3.5" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a workspace"
                aria-label="Find a workspace"
                className="placeholder:text-night-muted h-9 flex-1 bg-transparent text-sm text-white outline-none"
              />
            </div>
          )}
          <ul role="listbox" aria-label="Workspaces" className="max-h-80 overflow-y-auto p-1.5">
            {list.map((w) => {
              const active = w.organisationId === current?.organisationId;
              return (
                <li key={w.organisationId} role="option" aria-selected={active}>
                  <Link
                    href={href(w)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-night-text hover:bg-white/[0.05]",
                    )}
                  >
                    <Mark w={w} />
                    <span className="min-w-0 flex-1 truncate">
                      {w.isInternal ? "Mea Creo HQ" : w.name}
                    </span>
                    {active && <Check className="text-signal size-4" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            href="/workspace/clients/new"
            className="border-night-line text-night-muted block border-t px-4 py-2.5 text-xs hover:text-white"
          >
            + Add a client workspace
          </Link>
        </div>
      )}
    </div>
  );
}
