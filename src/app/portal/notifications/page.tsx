import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { markAllReadAction } from "@/app/workspace/notifications/actions";
import { SubmitButton } from "@/components/ui/form";
import { Card, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { fmtRelative } from "@/lib/format";
import { requireClient } from "@/modules/auth/context";

export const metadata: Metadata = { title: "Notifications" };

export default async function PortalNotifications() {
  const ctx = await requireClient();
  const rows = await (
    await getDb()
  )
    .select()
    .from(notifications)
    .where(eq(notifications.userId, ctx.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-ink text-3xl">Notifications</h1>
        {rows.some((n) => !n.readAt) && (
          <form action={markAllReadAction}>
            <SubmitButton size="sm" variant="secondary">
              Mark all as read
            </SubmitButton>
          </form>
        )}
      </header>
      {rows.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {rows.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link?.startsWith("/portal") ? n.link : "/portal"}
                  className="hover:bg-surface-2 flex items-start gap-3 px-5 py-3"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "" : "bg-clay-600"}`}
                  />
                  <span className="flex-1">
                    <span className={`block text-sm ${n.readAt ? "" : "font-medium"}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="text-muted block text-xs">{n.body}</span>}
                  </span>
                  <span className="text-muted text-xs">{fmtRelative(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
