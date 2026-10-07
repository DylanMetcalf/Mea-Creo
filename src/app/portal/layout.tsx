import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Bell, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction, switchOrganisationAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Toaster } from "@/components/ui/overlay";
import { PortalMobileNav, PortalNav } from "@/components/portal/nav";
import { Avatar } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { approvals, clients, invoices, notifications, organisations } from "@/db/schema";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s | Mea Creo" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const ctx = await requireClient("portal.access");
  const db = await getDb();
  const [[pending], [unread], [client], [overdue]] = await Promise.all([
    db
      .select({ n: count() })
      .from(approvals)
      .where(
        and(
          eq(approvals.organisationId, ctx.organisationId),
          eq(approvals.status, "pending"),
          eq(approvals.level, "client"),
        ),
      ),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))),
    db
      .select({ billingState: clients.billingState, isDemo: organisations.isDemo })
      .from(clients)
      .innerJoin(organisations, eq(organisations.id, clients.organisationId))
      .where(eq(clients.organisationId, ctx.organisationId)),
    db
      .select({ n: count() })
      .from(invoices)
      .where(
        and(eq(invoices.organisationId, ctx.organisationId), inArray(invoices.status, ["overdue"])),
      ),
  ]);
  const badges = { "/portal/approvals": pending?.n ?? 0, "/portal/billing": overdue?.n ?? 0 };
  const canBill = ctx.can("portal.billing");
  const paused = client?.billingState === "suspended" || client?.billingState === "overdue";

  return (
    <div className="bg-paper min-h-dvh pb-20 lg:pb-0">
      <a
        href="#main"
        className="focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-border/70 bg-paper/80 sticky top-0 z-20 border-b backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo href="/portal" size="sm" wordmarkFrom="sm" />
          <span className="label-mono border-border text-muted hidden rounded-full border px-2 py-0.5 sm:inline">
            Client portal
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {ctx.organisations.length > 1 ? (
              <form action={switchOrganisationAction} className="flex items-center gap-1">
                <label htmlFor="org-switch" className="sr-only">
                  Organisation
                </label>
                <select
                  id="org-switch"
                  name="organisationId"
                  defaultValue={ctx.organisationId}
                  className="border-border bg-surface h-8 max-w-40 rounded-md border px-2 text-xs"
                >
                  {ctx.organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button className="border-border h-8 rounded-md border px-2 text-xs">Switch</button>
              </form>
            ) : (
              <span className="min-w-0 truncate text-sm font-medium sm:max-w-56">
                {ctx.organisationName}
              </span>
            )}
            <ThemeToggle compact />
            <Link
              href="/portal/notifications"
              className="hover:bg-surface-2 relative rounded-md p-2"
              aria-label={`Notifications${unread?.n ? `, ${unread.n} unread` : ""}`}
            >
              <Bell className="size-5" aria-hidden />
              {unread?.n ? (
                <span className="bg-clay-600 absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold text-white">
                  {unread.n}
                </span>
              ) : null}
            </Link>
            <Link href="/portal/settings" className="rounded-full" aria-label="Your account">
              <Avatar name={ctx.user.name} size="sm" />
            </Link>
            <form action={logoutAction} className="hidden sm:block">
              <button
                className="text-muted hover:bg-surface-2 rounded-md p-2"
                aria-label="Sign out"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      {client?.isDemo && (
        <div className="bg-warning-100 text-warning-700 px-4 py-1.5 text-center text-xs">
          Demo account: fictional company and data, for trying the portal.
        </div>
      )}
      {paused && canBill && (
        <div className="bg-danger-100 text-danger-700 px-4 py-2 text-center text-sm">
          Some services are paused because an invoice is overdue. Your data is safe.{" "}
          <Link href="/portal/billing" className="font-medium underline">
            Pay now to resume
          </Link>
        </div>
      )}
      <div className="mx-auto flex max-w-6xl gap-10 px-4 py-6 sm:px-6 lg:py-9">
        <aside className="sticky top-24 hidden h-fit w-52 shrink-0 lg:block">
          <PortalNav badges={badges} hideBilling={!canBill} />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <PortalMobileNav badges={badges} />
      <Toaster />
    </div>
  );
}
