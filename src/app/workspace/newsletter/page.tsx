import { MailPlus } from "lucide-react";
import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { Table } from "@/components/ui/feedback";
import { Badge, Callout, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { getEnv } from "@/config/env";
import { fmtDate } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { listSubscribers, TOPIC_LABELS } from "@/modules/newsletter/service";

export const metadata: Metadata = { title: "Newsletter" };

export default async function NewsletterPage() {
  const ctx = await requireStaff("content.write");
  const rows = await listSubscribers(await getDb());
  const active = rows.filter((r) => r.status === "subscribed");
  const emailReady = getEnv().EMAIL_PROVIDER !== "none" && getEnv().EMAIL_PROVIDER !== "mock";
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-ink text-3xl">Newsletter</h1>
          <p className="text-muted mt-1">
            {active.length} subscribed · {rows.length - active.length} unsubscribed. People join
            from the blog with explicit consent; each row keeps the consent wording and date.
          </p>
        </div>
        {ctx.can("data.export") && active.length > 0 && (
          <LinkButton href="/api/export/newsletter" variant="secondary">
            Export subscribers (CSV)
          </LinkButton>
        )}
      </header>
      <Callout tone="info" title="Sending">
        {emailReady
          ? "Email is connected for one-to-one messages. Newsletter sending isn't built into HQ yet: export the list into your email tool and include each subscriber's unsubscribe link."
          : "Email isn't connected yet, so nothing is sent from here. When you send a newsletter, use only the exported list (it excludes unsubscribed people) and include an unsubscribe link."}{" "}
        Unsubscribe links take the form /newsletter/unsubscribe?token=… and work immediately.
      </Callout>
      {rows.length === 0 ? (
        <EmptyState
          icon={<MailPlus className="size-5" />}
          title="No subscribers yet"
          description="The sign-up form is on the blog and at the end of every article."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Topics</th>
              <th>Source</th>
              <th>Consent</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <p className="font-medium">{r.email}</p>
                  {r.name && <p className="text-muted text-xs">{r.name}</p>}
                </td>
                <td className="text-xs">
                  {r.topics.map((t) => TOPIC_LABELS[t]).join(", ") || "All"}
                </td>
                <td className="text-muted text-xs">{r.source ?? "-"}</td>
                <td className="text-muted text-xs">{fmtDate(r.consentAt)}</td>
                <td>
                  <Badge tone={r.status === "subscribed" ? "success" : "neutral"}>
                    {r.status === "subscribed"
                      ? "Subscribed"
                      : `Unsubscribed ${fmtDate(r.unsubscribedAt)}`}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
