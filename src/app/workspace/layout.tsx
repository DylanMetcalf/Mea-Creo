import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { Bell, LogOut, Menu, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/primitives";
import { NavLinks, SearchShortcut } from "@/components/workspace/nav";
import { getDb } from "@/db";
import { approvals, notifications } from "@/db/schema";
import { requireStaff } from "@/modules/auth/context";
import { ROLE_LABELS } from "@/modules/auth/permissions";
import { getPlatformSetting } from "@/modules/settings/service";

export const metadata: Metadata = {
  title: { default: "Workspace", template: "%s | Mea Creo Workspace" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  ["/workspace/clients/new", "Add client"],
  ["/workspace/leads/new", "Add lead"],
  ["/workspace/tasks?new=1", "Create task"],
  ["/workspace/audits?new=1", "Run audit"],
  ["/workspace/meetings?new=1", "Book meeting"],
  ["/workspace/proposals", "Create proposal"],
  ["/workspace/runs", "Run growth"],
];

export default async function WorkspaceLayout({ children }: LayoutProps<"/workspace">) {
  const ctx = await requireStaff("workspace.access");
  const db = await getDb();
  const [[unread], [pendingApprovals], emergency, billing] = await Promise.all([
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))),
    db
      .select({ n: count() })
      .from(approvals)
      .where(
        and(eq(approvals.status, "pending"), inArray(approvals.level, ["internal", "manual"])),
      ),
    getPlatformSetting(db, "emergency"),
    getPlatformSetting(db, "billing"),
  ]);
  const badges = { "/workspace/approvals": pendingApprovals?.n ?? 0 };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-3 py-4">
        <Logo href="/workspace" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        <NavLinks badges={badges} />
      </div>
      <div className="border-border border-t p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={ctx.user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{ctx.user.name}</p>
            <p className="text-muted text-xs">{ROLE_LABELS[ctx.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-subtle hover:bg-surface-2 hover:text-ink rounded-md p-1.5"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-paper flex min-h-screen">
      <SearchShortcut />
      <aside className="border-border bg-surface sticky top-0 hidden h-screen w-60 shrink-0 border-r lg:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {(emergency.pauseAllAutomation ||
          emergency.pauseOutboundEmail ||
          emergency.pausePayments) && (
          <div role="alert" className="bg-danger-700 px-4 py-2 text-center text-sm text-white">
            Emergency controls active:{" "}
            {[
              emergency.pauseAllAutomation && "automation paused",
              emergency.pauseOutboundEmail && "outbound email paused",
              emergency.pausePayments && "payments paused",
            ]
              .filter(Boolean)
              .join(", ")}
            .{" "}
            <Link href="/workspace/settings?tab=emergency" className="underline">
              Manage
            </Link>
          </div>
        )}
        <header className="border-border bg-surface/90 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
          <details className="relative lg:hidden">
            <summary
              className="hover:bg-surface-2 flex size-9 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </summary>
            <div className="border-border bg-surface shadow-raised fixed inset-y-0 left-0 z-50 w-72 border-r">
              {sidebar}
            </div>
          </details>
          <form action="/workspace/search" className="relative max-w-md flex-1">
            <Search
              className="text-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <label htmlFor="global-search" className="sr-only">
              Search clients, leads, tasks, documents
            </label>
            <input
              id="global-search"
              name="q"
              type="search"
              placeholder="Search clients, leads, tasks…  ( / )"
              className="border-border bg-surface-2 placeholder:text-subtle focus:border-brand-600 focus:bg-surface h-9 w-full rounded-lg border pr-3 pl-9 text-sm focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            {billing.pricesAreDemo && (
              <Link
                href="/workspace/services"
                className="bg-warning-100 text-warning-700 hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-block"
                title="Contains fictional demo data and demo prices"
              >
                Demo data
              </Link>
            )}
            <details className="relative">
              <summary className="bg-brand-700 hover:bg-brand-800 flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
                <Plus className="size-4" aria-hidden />{" "}
                <span className="hidden sm:inline">New</span>
              </summary>
              <div className="rounded-card border-border bg-surface shadow-raised absolute right-0 mt-2 w-48 border p-1">
                {QUICK_ACTIONS.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="hover:bg-surface-2 block rounded-md px-3 py-2 text-sm"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </details>
            <Link
              href="/workspace/notifications"
              className="text-ink-soft hover:bg-surface-2 relative rounded-lg p-2"
              aria-label={`Notifications${unread?.n ? `, ${unread.n} unread` : ""}`}
            >
              <Bell className="size-5" />
              {unread?.n ? (
                <span className="bg-clay-600 absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white">
                  {Math.min(unread.n, 9)}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
