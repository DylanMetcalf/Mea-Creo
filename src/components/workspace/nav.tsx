"use client";

import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Camera,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  Layers,
  Menu,
  MessageSquareQuote,
  type LucideIcon,
  Newspaper,
  Palette,
  Search,
  Send,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const WORKSPACE_NAV: { title: string; items: NavItem[] }[] = [
  { title: "", items: [{ href: "/workspace", label: "Command Centre", icon: Gauge }] },
  {
    title: "Clients",
    items: [
      { href: "/workspace/clients", label: "Clients", icon: Users },
      { href: "/workspace/approvals", label: "Approvals", icon: ClipboardCheck },
      { href: "/workspace/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/workspace/meetings", label: "Calendar", icon: CalendarDays },
      { href: "/workspace/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/workspace/leads", label: "Leads & pipeline", icon: Target },
      { href: "/workspace/outreach", label: "Outreach", icon: Send },
      { href: "/workspace/audits", label: "Visibility reports", icon: Search },
      { href: "/workspace/proposals", label: "Proposals", icon: FileText },
      { href: "/workspace/portfolio", label: "Portfolio", icon: Camera },
      { href: "/workspace/testimonials", label: "Testimonials", icon: MessageSquareQuote },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/workspace/runs", label: "Runs & agents", icon: Bot },
      { href: "/workspace/billing", label: "Billing", icon: CreditCard },
      { href: "/workspace/services", label: "Services & pricing", icon: Layers },
      { href: "/workspace/insights", label: "Website content", icon: Newspaper },
    ],
  },
  {
    title: "",
    items: [
      { href: "/workspace/business", label: "Business", icon: BriefcaseBusiness },
      { href: "/workspace/settings", label: "Settings", icon: Settings },
      { href: "/workspace/design-system", label: "Design system", icon: Palette },
    ],
  },
];

export function NavLinks({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-6">
      {WORKSPACE_NAV.map((group, gi) => (
        <div key={gi}>
          {group.title && <p className="label-mono text-night-muted/70 mb-2 px-3">{group.title}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/workspace"
                  ? pathname === "/workspace"
                  : pathname.startsWith(item.href);
              const badge = badges[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/item relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[0.9rem] transition-colors duration-200",
                      active
                        ? "bg-white/[0.08] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                        : "text-night-muted hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="bg-signal absolute top-1/2 -left-2 h-5 w-[3px] -translate-y-1/2 rounded-full shadow-[0_0_12px_rgb(127_224_178/0.8)]"
                      />
                    )}
                    <item.icon
                      className={cn(
                        "size-[18px] transition-colors",
                        active ? "text-signal" : "text-night-muted group-hover/item:text-white",
                      )}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                    {badge ? (
                      <span className="bg-ember-500 text-night rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Where you are: "Leads & pipeline / Ridgeback Software". Labels come from the nav. */
export function Breadcrumb() {
  const pathname = usePathname();
  const item = WORKSPACE_NAV.flatMap((g) => g.items)
    .filter((i) => i.href !== "/workspace")
    .find((i) => pathname.startsWith(i.href));
  const deeper = item && pathname.length > item.href.length + 1;
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
      <Link href="/workspace" className="text-muted hover:text-ink transition-colors">
        Workspace
      </Link>
      {item && (
        <>
          <span className="text-subtle" aria-hidden>
            /
          </span>
          <Link
            href={item.href}
            aria-current={deeper ? undefined : "page"}
            className={cn(
              "truncate transition-colors",
              deeper ? "text-muted hover:text-ink" : "text-ink font-medium",
            )}
          >
            {item.label}
          </Link>
        </>
      )}
    </nav>
  );
}

/** Mobile navigation drawer. Closes on navigation, Escape and backdrop click. */
export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(pathname);
  if (last !== pathname) {
    setLast(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open navigation"
        className="hover:bg-surface-2 flex size-9 items-center justify-center rounded-lg"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="bg-night/50 absolute inset-0 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="bg-night absolute inset-y-0 left-0 w-72 shadow-[20px_0_60px_-20px_rgb(0_0_0/0.5)] motion-safe:animate-[slide-in_.25s_var(--ease-out)]">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/** Opens the command palette with "/" or Ctrl/Cmd+K. */
export function SearchShortcut() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        window.dispatchEvent(new Event("mc:command"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
