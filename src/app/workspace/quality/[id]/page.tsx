import { eq } from "drizzle-orm";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { Badge, Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { clients, QA_STAGES } from "@/db/schema";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { getDeliverable, KIND_LABELS, nextStage, QA_STAGE_LABELS } from "@/modules/quality/service";
import { moveDeliverableAction, toggleCheckAction } from "../actions";

export const metadata: Metadata = { title: "Deliverable" };

export default async function DeliverablePage({ params }: PageProps<"/workspace/quality/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const db = await getDb();
  const d = await getDeliverable(db, id);
  if (!d) notFound();
  try {
    await assertStaffClientAccess(ctx, d.organisationId);
  } catch {
    notFound();
  }
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.organisationId, d.organisationId));
  const canWrite = ctx.can("tasks.write");
  const { next, blocked } = nextStage(d);
  const current = QA_STAGES.indexOf(d.stage);
  const editableChecks = d.stage === "internal_review" || d.stage === "qa";
  const done = d.checklist.filter((c) => c.done).length;

  return (
    <>
      <Link
        href="/workspace/quality"
        className="text-muted hover:text-ink mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Quality
      </Link>
      <header className="mb-6">
        <p className="text-muted text-sm">
          <Link
            href={`/workspace/clients/${d.organisationId}`}
            className="hover:text-ink underline decoration-current/30"
          >
            {client?.name}
          </Link>{" "}
          · {KIND_LABELS[d.kind]}
          {d.dueAt ? ` · due ${fmtDate(d.dueAt)}` : ""}
        </p>
        <h1 className="font-display text-ink mt-1 text-[1.75rem] leading-tight">{d.title}</h1>
        {d.link && (
          <a
            href={d.link}
            target="_blank"
            rel="noreferrer"
            className="text-brand-700 mt-2 inline-flex items-center gap-1 text-sm underline decoration-current/30"
          >
            Open the work <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </header>

      <ol className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Stages">
        {QA_STAGES.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={
              i < current
                ? "bg-accent/10 text-brand-700 rounded-lg px-3 py-2 text-xs font-medium"
                : i === current
                  ? "bg-accent rounded-lg px-3 py-2 text-xs font-semibold text-white"
                  : "bg-surface-2 text-muted rounded-lg px-3 py-2 text-xs"
            }
          >
            <span className="inline-flex items-center gap-1">
              {i < current && <Check className="size-3.5" aria-hidden />}
              {QA_STAGE_LABELS[s]}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="QA checklist"
              description={`${done} of ${d.checklist.length} checked${editableChecks ? "" : " (locked at this stage)"}`}
            />
            <ul className="divide-border/70 divide-y">
              {d.checklist.map((c) => (
                <li key={c.key} className="flex items-center gap-3 px-5 py-3">
                  {canWrite && editableChecks ? (
                    <form action={toggleCheckAction.bind(null, d.id, c.key, !c.done)}>
                      <button
                        type="submit"
                        aria-label={`${c.done ? "Uncheck" : "Check"} ${c.label}`}
                        aria-pressed={c.done}
                        className={
                          c.done
                            ? "bg-accent flex size-6 items-center justify-center rounded-md text-white"
                            : "border-border-strong hover:border-brand-500 size-6 rounded-md border-2"
                        }
                      >
                        {c.done && <Check className="size-4" aria-hidden />}
                      </button>
                    </form>
                  ) : (
                    <span
                      aria-hidden
                      className={
                        c.done
                          ? "bg-accent flex size-6 items-center justify-center rounded-md text-white"
                          : "border-border size-6 rounded-md border-2"
                      }
                    >
                      {c.done && <Check className="size-4" />}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={c.done ? "text-ink text-sm" : "text-ink-soft text-sm"}>
                      {c.label}
                    </p>
                    {c.done && c.by && (
                      <p className="text-subtle text-xs">
                        {c.by}
                        {c.at ? `, ${fmtDateTime(new Date(c.at))}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {d.notes && (
            <Card>
              <CardHeader title="Brief and notes" />
              <CardBody>
                <p className="text-ink-soft text-sm whitespace-pre-line">{d.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Stage" description={QA_STAGE_LABELS[d.stage]} />
            <CardBody className="space-y-4">
              {blocked && (
                <Callout tone={d.stage === "client_review" ? "neutral" : "warning"} title="Not yet">
                  {blocked}
                </Callout>
              )}
              {canWrite && next && !blocked && (
                <ActionForm action={moveDeliverableAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="to" value={next} />
                  <SubmitButton className="w-full">
                    {next === "client_review"
                      ? "Send to the client for review"
                      : `Move to ${QA_STAGE_LABELS[next]}`}
                  </SubmitButton>
                </ActionForm>
              )}
              {canWrite && current > 0 && d.stage !== "published" && (
                <details>
                  <summary className="text-muted cursor-pointer text-sm">Send back</summary>
                  <ActionForm action={moveDeliverableAction} className="mt-3 space-y-3">
                    <input type="hidden" name="id" value={d.id} />
                    <SelectField
                      name="to"
                      label="Back to"
                      options={QA_STAGES.slice(0, current).map((s) => ({
                        value: s,
                        label: QA_STAGE_LABELS[s],
                      }))}
                      defaultValue={QA_STAGES[current - 1]}
                    />
                    <TextField name="note" label="Why" required />
                    <SubmitButton size="sm" variant="secondary">
                      Send back
                    </SubmitButton>
                  </ActionForm>
                </details>
              )}
              {d.approvalId && (
                <Link
                  href={`/workspace/approvals/${d.approvalId}`}
                  className="text-brand-700 block text-sm underline decoration-current/30"
                >
                  View the client approval
                </Link>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <ol className="space-y-3 px-5 py-4">
              {[...d.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`} className="text-sm">
                  <Badge tone={h.stage === "published" ? "success" : "neutral"}>
                    {QA_STAGE_LABELS[h.stage]}
                  </Badge>
                  <p className="text-muted mt-1 text-xs">
                    {h.by}, {fmtDateTime(new Date(h.at))}
                  </p>
                  {h.note && <p className="text-ink-soft mt-0.5 text-xs">&ldquo;{h.note}&rdquo;</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
