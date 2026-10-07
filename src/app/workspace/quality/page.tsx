import { and, asc, inArray, ne } from "drizzle-orm";
import { Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { clients, DELIVERABLE_KINDS, QA_STAGES } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { KIND_LABELS, listDeliverables, QA_STAGE_LABELS } from "@/modules/quality/service";
import { createDeliverableAction } from "./actions";

export const metadata: Metadata = { title: "Quality" };

export default async function QualityPage({ searchParams }: PageProps<"/workspace/quality">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const clientFilter = typeof sp.client === "string" ? sp.client : undefined;
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const [rows, clientRows] = await Promise.all([
    listDeliverables(db, scope),
    db
      .select({ organisationId: clients.organisationId, name: clients.name })
      .from(clients)
      .where(
        and(
          ne(clients.lifecycle, "offboarded"),
          scope === "all"
            ? undefined
            : inArray(
                clients.organisationId,
                scope.length ? scope : ["00000000-0000-0000-0000-000000000000"],
              ),
        ),
      )
      .orderBy(asc(clients.name)),
  ]);
  const visible = clientFilter ? rows.filter((r) => r.d.organisationId === clientFilter) : rows;
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Quality"
        description="Every deliverable moves through internal review, a QA checklist and client review before it's published."
      />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/workspace/quality"
          className={
            !clientFilter
              ? "bg-ink text-paper rounded-full px-3 py-1"
              : "text-muted hover:text-ink rounded-full px-3 py-1"
          }
        >
          All clients
        </Link>
        {clientRows
          .filter((c) => rows.some((r) => r.d.organisationId === c.organisationId))
          .map((c) => (
            <Link
              key={c.organisationId}
              href={`/workspace/quality?client=${c.organisationId}`}
              className={
                clientFilter === c.organisationId
                  ? "bg-ink text-paper rounded-full px-3 py-1"
                  : "text-muted hover:text-ink rounded-full px-3 py-1"
              }
            >
              {c.name}
            </Link>
          ))}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {QA_STAGES.map((stage) => {
            const items = visible.filter((r) => r.d.stage === stage);
            return (
              <section
                key={stage}
                className="bg-surface-2/60 border-border/60 rounded-2xl border p-2"
              >
                <h2 className="label-mono text-muted flex items-center justify-between px-2 py-1.5">
                  {QA_STAGE_LABELS[stage]}
                  <span className="tabular-nums">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map(({ d, clientName }) => {
                    const done = d.checklist.filter((c) => c.done).length;
                    const overdue = d.dueAt && d.dueAt < now && stage !== "published";
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/workspace/quality/${d.id}`}
                          className="bg-surface border-border/80 shadow-card hover:border-brand-300 block rounded-xl border p-3 transition-colors"
                        >
                          <p className="text-muted truncate text-xs">{clientName}</p>
                          <p className="text-ink mt-0.5 line-clamp-2 text-sm font-medium">
                            {d.title}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge>{KIND_LABELS[d.kind]}</Badge>
                            {(stage === "internal_review" || stage === "qa") && (
                              <Badge tone={done === d.checklist.length ? "success" : "neutral"}>
                                {done}/{d.checklist.length} checks
                              </Badge>
                            )}
                            {d.dueAt && (
                              <span
                                className={
                                  overdue ? "text-danger-700 text-xs" : "text-muted text-xs"
                                }
                              >
                                Due {fmtDate(d.dueAt)}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                  {items.length === 0 && (
                    <li className="text-subtle px-2 py-3 text-center text-xs">Nothing here</li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {ctx.can("tasks.write") && (
        <Card className="mt-6 max-w-3xl">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Plus className="size-4" aria-hidden /> New deliverable
              </span>
            }
            description="It gets the QA checklist for its type from Settings → Quality."
          />
          <CardBody>
            <ActionForm
              action={createDeliverableAction}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <SelectField
                name="organisationId"
                label="Client"
                defaultValue={clientFilter}
                placeholder="Choose a client"
                options={clientRows.map((c) => ({ value: c.organisationId, label: c.name }))}
                required
              />
              <SelectField
                name="kind"
                label="Type"
                defaultValue="content"
                options={DELIVERABLE_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
              />
              <TextField name="title" label="Title" required className="sm:col-span-2" />
              <TextField name="link" label="Link to the work" inputMode="url" />
              <TextField name="dueAt" label="Due" type="date" />
              <TextArea name="notes" label="Brief or notes" rows={3} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <SubmitButton>
                  <ShieldCheck className="size-4" aria-hidden /> Create
                </SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      )}
    </>
  );
}
