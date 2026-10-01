import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { getDb } from "@/db";
import { fmtDateTime, fmtRelative, humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { loadOutreachOverview } from "@/modules/outreach/service";
import { addSuppressionAction } from "./actions";

export const metadata: Metadata = { title: "Outreach" };

const TABS = ["queue", "replies", "sent", "suppressed"] as const;

export default async function OutreachPage({ searchParams }: PageProps<"/workspace/outreach">) {
  const ctx = await requireStaff("leads.read");
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "queue";
  const db = await getDb();
  const { settings, sentToday, sent30, replies30, optOuts30, queueCount, rows, suppressed } =
    await loadOutreachOverview(db, tab);

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Permission-based prospecting. Every message is approved by a person; opt-outs are permanent across every channel."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Sent today"
          value={`${sentToday} / ${settings.maxPerDay}`}
          hint="Daily limit (Settings → Outreach)"
          tone={sentToday >= settings.maxPerDay ? "warning" : "default"}
        />
        <Stat label="Sent, 30 days" value={sent30} />
        <Stat
          label="Reply rate, 30 days"
          value={sent30 ? `${Math.round((replies30 / sent30) * 100)}%` : "-"}
          hint={`${replies30} repl${replies30 === 1 ? "y" : "ies"}`}
        />
        <Stat
          label="Opt-outs, 30 days"
          value={optOuts30}
          tone={sent30 && optOuts30 / sent30 > 0.1 ? "danger" : "default"}
          hint={
            sent30 && optOuts30 / sent30 > 0.1 ? "High: review targeting and messages" : undefined
          }
        />
      </div>
      <Tabs
        baseHref="/workspace/outreach"
        active={tab}
        tabs={[
          { key: "queue", label: "Waiting", count: queueCount },
          { key: "replies", label: "Replies (30 days)", count: replies30 },
          { key: "sent", label: "Sent" },
          { key: "suppressed", label: "Do not contact" },
        ]}
      />

      {tab === "suppressed" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Do-not-contact list"
              description="Checked before every draft and again before every send. Entries are never removed automatically."
            />
            <CardBody>
              {suppressed.length === 0 ? (
                <p className="text-muted text-sm">Nobody yet.</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {suppressed.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="min-w-0 break-all">
                        <Badge tone="neutral">{s.kind}</Badge> {s.identifier}
                      </span>
                      <span className="text-muted text-xs">
                        {humanize(s.reason)}
                        {s.source ? ` · ${s.source}` : ""} · {fmtDateTime(s.createdAt)}
                        {s.leadId && (
                          <>
                            {" · "}
                            <Link href={`/workspace/leads/${s.leadId}`} className="hover:underline">
                              lead
                            </Link>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {ctx.can("leads.write") && (
            <Card>
              <CardHeader
                title="Add someone"
                description="E.g. they asked by phone not to be contacted."
              />
              <CardBody>
                <ActionForm action={addSuppressionAction} className="space-y-3" resetOnSuccess>
                  <SelectField
                    name="kind"
                    label="Type"
                    options={[
                      { value: "email", label: "Email address" },
                      { value: "phone", label: "Phone number" },
                      { value: "linkedin", label: "LinkedIn profile URL" },
                      { value: "domain", label: "Whole company (email domain)" },
                    ]}
                  />
                  <TextField name="identifier" label="Value" />
                  <SubmitButton size="sm">Add to list</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title={tab === "queue" ? "Nothing waiting" : "Nothing here yet"}
          description={
            tab === "queue"
              ? "Draft outreach from a lead's page, or let the daily run prepare drafts for qualified prospects."
              : undefined
          }
        />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {rows.map(({ c, company, leadId }) => (
              <li key={c.id}>
                <Link
                  href={
                    c.status === "pending_approval" && c.approvalId
                      ? `/workspace/approvals/${c.approvalId}`
                      : `/workspace/leads/${leadId}`
                  }
                  className="hover:bg-surface-2 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {company ?? "Unknown"}
                      {c.toName ? ` · ${c.toName}` : ""}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {humanize(c.channel)} · {humanize(c.purpose)} ·{" "}
                      {c.subject ?? c.body.slice(0, 80)} · {fmtRelative(c.createdAt)}
                    </p>
                    {c.nextAction && tab === "replies" && (
                      <p className="text-ink-soft mt-1 text-xs">Next: {c.nextAction}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.classification && <Badge tone="info">{humanize(c.classification)}</Badge>}
                    <Badge
                      tone={
                        c.status === "pending_approval"
                          ? "warning"
                          : c.status === "approved"
                            ? "brand"
                            : "neutral"
                      }
                    >
                      {c.status === "approved" && c.channel !== "email"
                        ? "Approved: send it yourself"
                        : humanize(c.status)}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
