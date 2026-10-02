import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { Bell, LogOut, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { CommandPalette, CommandTrigger } from "@/components/workspace/command-palette";
import { Breadcrumb, MobileSidebar, NavLinks, SearchShortcut } from "@/components/workspace/nav";
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

const QUICK_ACTIONS: [string, string][] = [
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
    <div className="bg-night text-night-text relative isolate flex h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(90%_70%_at_0%_0%,rgb(127_224_178/0.14),transparent_70%)]"
      />
      <div className="px-5 pt-5 pb-4">
        <Logo href="/workspace" inverse size="sm" />
        <div className="border-night-line mt-5 flex items-center gap-2.5 rounded-xl border bg-white/[0.03] px-3 py-2.5">
          <span className="bg-signal size-2 rounded-full shadow-[0_0_10px_rgb(127_224_178/0.9)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Mea Creo HQ</p>
            <p className="text-night-muted text-xs">Workspace</p>
          </div>
        </div>
      </div>
      <div className="flex-1 [scrollbar-color:rgb(255_255_255/0.15)_transparent] overflow-y-auto px-3 pb-6">
        <NavLinks badges={badges} />
      </div>
      <div className="border-night-line border-t p-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <Avatar name={ctx.user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{ctx.user.name}</p>
            <p className="text-night-muted text-xs">{ROLE_LABELS[ctx.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-night-muted rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
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
      <CommandPalette actions={QUICK_ACTIONS} />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
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
        <header className="border-border/70 bg-paper/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
          <MobileSidebar>{sidebar}</MobileSidebar>
          <Breadcrumb />
          <div className="flex min-w-0 flex-1 justify-end md:justify-center">
            <CommandTrigger />
          </div>
          <div className="flex items-center gap-1.5">
            {billing.pricesAreDemo && (
              <Link
                href="/workspace/services"
                className="bg-warning-100 text-warning-700 hidden rounded-full px-2.5 py-1 text-xs font-medium xl:inline-block"
                title="Contains fictional demo data and demo prices"
              >
                Demo data
              </Link>
            )}
            <details className="relative">
              <summary
                className={buttonClass(
                  "primary",
                  "sm",
                  "h-9 cursor-pointer list-none px-3 [&::-webkit-details-marker]:hidden",
                )}
              >
                <Plus className="size-4" aria-hidden />{" "}
                <span className="hidden sm:inline">New</span>
              </summary>
              <div className="border-border bg-elevated shadow-lifted absolute right-0 mt-2 w-52 rounded-xl border p-1.5 motion-safe:animate-[pop-in_.15s_var(--ease-out)]">
                {QUICK_ACTIONS.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="hover:bg-brand-50 hover:text-brand-900 block rounded-lg px-3 py-2 text-sm transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </details>
            <Link
              href="/workspace/notifications"
              className="text-ink-soft hover:bg-surface relative rounded-lg p-2 transition-colors"
              aria-label={`Notifications${unread?.n ? `, ${unread.n} unread` : ""}`}
            >
              <Bell className="size-5" />
              {unread?.n ? (
                <span className="bg-clay-600 ring-paper absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white ring-2">
                  {Math.min(unread.n, 9)}
                </span>
              ) : null}
            </Link>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
