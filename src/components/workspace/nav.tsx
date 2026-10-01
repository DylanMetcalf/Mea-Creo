"use client";

import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  Layers,
  type LucideIcon,
  Newspaper,
  Search,
  Settings,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
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
      { href: "/workspace/audits", label: "Visibility reports", icon: Search },
      { href: "/workspace/proposals", label: "Proposals", icon: FileText },
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
    ],
  },
];

export function NavLinks({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="space-y-5">
      {WORKSPACE_NAV.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <p className="text-subtle mb-1.5 px-3 text-[0.7rem] font-semibold tracking-wider uppercase">
              {group.title}
            </p>
          )}
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
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-brand-50 text-brand-900 font-medium"
                        : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <item.icon
                      className={cn("size-4", active ? "text-brand-700" : "text-subtle")}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                    {badge ? (
                      <span className="bg-clay-100 text-clay-600 rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums">
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

/** Focuses the global search with "/" or Ctrl/Cmd+K. */
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
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
