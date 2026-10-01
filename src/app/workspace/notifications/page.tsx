import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { fmtRelative } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { markAllReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireStaff();
  const rows = await (
    await getDb()
  )
    .select()
    .from(notifications)
    .where(eq(notifications.userId, ctx.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const unread = rows.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "All caught up."}
        actions={
          unread > 0 && (
            <form action={markAllReadAction}>
              <SubmitButton variant="secondary">Mark all as read</SubmitButton>
            </form>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title="No notifications" />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {rows.map((n) => {
              const inner = (
                <>
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-clay-600"}`}
                    aria-label={n.readAt ? undefined : "Unread"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? "" : "font-medium"}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="text-muted block text-xs">{n.body}</span>}
                  </span>
                  <span className="text-muted shrink-0 text-xs">{fmtRelative(n.createdAt)}</span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="hover:bg-surface-2 flex items-start gap-3 px-5 py-3"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
