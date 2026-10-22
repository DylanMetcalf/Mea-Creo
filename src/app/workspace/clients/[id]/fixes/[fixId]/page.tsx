import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/ui/copy-button";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui/primitives";
import { getDb } from "@/db";
import type { FixStatus } from "@/db/schema";
import { fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { clientDetail } from "@/modules/clients/queries";
import { CMS_LABELS } from "@/modules/execution/cms";
import { allowedTransitions, FIX_STATUS_LABELS, getFix } from "@/modules/execution/service";
import { editFixAction, transitionFixAction, verifyFixAction } from "../../../execution-actions";
import {
  AREA_LABELS,
  ClassificationBadge,
  FixStatusBadge,
  PriorityBadge,
} from "@/components/execution/fix-badges";

export const metadata: Metadata = { title: "Fix" };

const ACTION_LABELS: Partial<Record<FixStatus, string>> = {
  review: "Send to review",
  approved: "Approve",
  applied: "Mark as applied",
  draft: "Back to draft",
  dismissed: "Dismiss",
};

export default async function FixPage({
  params,
}: PageProps<"/workspace/clients/[id]/fixes/[fixId]">) {
  const ctx = await requireStaff();
  const { id, fixId } = await params;
  try {
    await assertStaffClientAccess(ctx, id);
  } catch {
    notFound();
  }
  const db = await getDb();
  const data = await clientDetail(db, id);
  if (!data) notFound();
  let fix;
  try {
    fix = await getFix(db, id, fixId);
  } catch {
    notFound();
  }
  const editable = (fix.status === "draft" || fix.status === "review") && ctx.can("content.write");
  const hidden = (
    <>
      <input type="hidden" name="organisationId" value={id} />
      <input type="hidden" name="fixId" value={fix.id} />
    </>
  );
  const moves = allowedTransitions(fix.status).filter((to) =>
    to === "approved" ? ctx.can("approvals.decide") : ctx.can("content.write"),
  );

  return (
    <div className="max-w-5xl">
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/clients" className="hover:text-ink">
          Clients
        </Link>{" "}
        /{" "}
        <Link href={`/workspace/clients/${id}?tab=execution`} className="hover:text-ink">
          {data.client.name}
        </Link>{" "}
        / Fix
      </div>
      <header className="mb-6 space-y-3">
        <h1 className="font-display text-ink text-3xl">{fix.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <FixStatusBadge value={fix.status} />
          <ClassificationBadge value={fix.classification} />
          <PriorityBadge value={fix.priority} />
          <span className="text-muted">{AREA_LABELS[fix.area]}</span>
          <a
            href={fix.pageUrl}
            className="text-brand-700 truncate underline"
            target="_blank"
            rel="noreferrer"
          >
            {fix.pageUrl}
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="The issue" />
            <CardBody className="space-y-4">
              <p>{fix.issue}</p>
              {fix.evidence.map((e, i) => (
                <div key={i} className="space-y-1">
                  <p className="label-mono text-muted">
                    Evidence · {e.source} · {fmtDateTime(e.collectedAt)}
                  </p>
                  <pre className="bg-surface-2 overflow-x-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {e.observed}
                  </pre>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="The deliverable"
              description={editable ? "Edit before approval. Approved work is locked." : undefined}
            />
            <CardBody>
              {editable ? (
                <ActionForm action={editFixAction} className="space-y-4" successMessage="Saved.">
                  {hidden}
                  {fix.deliverable.parts.map((p, i) => (
                    <TextArea
                      key={i}
                      name={`part${i}`}
                      label={p.label}
                      defaultValue={p.value}
                      rows={Math.min(18, Math.max(2, p.value.split("\n").length + 1))}
                      className="font-mono text-xs"
                    />
                  ))}
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    Save changes
                  </SubmitButton>
                </ActionForm>
              ) : (
                <div className="space-y-4">
                  {fix.deliverable.parts.map((p, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{p.label}</p>
                        <CopyButton value={p.value} />
                      </div>
                      <pre className="bg-surface-2 overflow-x-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                        {p.value}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Where it goes and how to apply it"
              description={`Platform: ${CMS_LABELS[data.client.cms]}`}
            />
            <CardBody className="space-y-3">
              <p className="text-sm">
                <span className="font-medium">Location: </span>
                {fix.location}
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {fix.instructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Why, and what could go wrong" />
            <CardBody className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Expected benefit: </span>
                {fix.benefit}
              </p>
              {fix.dependencies.length > 0 && (
                <div>
                  <p className="font-medium">Dependencies</p>
                  <ul className="list-disc pl-5">
                    {fix.dependencies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fix.uncertainty && (
                <p>
                  <span className="font-medium">Uncertainty: </span>
                  {fix.uncertainty}
                </p>
              )}
              <p>
                <span className="font-medium">Rollback: </span>
                {fix.rollback}
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Workflow" description="Draft → Review → Approve → Apply → Verify" />
            <CardBody className="space-y-4">
              {fix.status === "applied" && ctx.can("content.write") && (
                <ActionForm action={verifyFixAction} className="space-y-2">
                  {hidden}
                  <p className="text-muted text-xs">{fix.verificationMethod}</p>
                  <SubmitButton pendingLabel="Checking the live site…">
                    Verify on live site
                  </SubmitButton>
                </ActionForm>
              )}
              {fix.lastVerification && (
                <Callout
                  tone={fix.lastVerification.passed ? "success" : "warning"}
                  title={fix.lastVerification.passed ? "Verified live" : "Not live yet"}
                >
                  {fix.lastVerification.observed}{" "}
                  <span className="text-muted">({fmtDateTime(fix.lastVerification.at)})</span>
                </Callout>
              )}
              {moves.map((to) => (
                <ActionForm key={to} action={transitionFixAction} className="space-y-2">
                  {hidden}
                  <input type="hidden" name="to" value={to} />
                  {to === "applied" && (
                    <TextArea
                      name="note"
                      label="Where and how it was applied"
                      rows={2}
                      required
                      hint="Only mark it applied once the change is saved on the live site."
                    />
                  )}
                  <SubmitButton
                    variant={
                      to === "dismissed" || to === "draft"
                        ? "ghost"
                        : to === "review" && fix.status === "approved"
                          ? "secondary"
                          : "primary"
                    }
                    pendingLabel="Saving…"
                  >
                    {to === "review" && fix.status === "approved"
                      ? "Back to review"
                      : to === "approved" && fix.status === "applied"
                        ? "Undo applied"
                        : ACTION_LABELS[to]}
                  </SubmitButton>
                </ActionForm>
              ))}
              {fix.status === "verified" && (
                <p className="text-muted text-sm">
                  Done. If the change is later undone on the site, the next site read drafts it
                  again.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-2 text-sm">
                {fix.history.map((h, i) => (
                  <li key={i}>
                    <span className="font-medium">{FIX_STATUS_LABELS[h.status]}</span>{" "}
                    <span className="text-muted">
                      · {h.by} · {fmtDateTime(h.at)}
                    </span>
                    {h.note && <span className="text-ink-soft block text-xs">{h.note}</span>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
