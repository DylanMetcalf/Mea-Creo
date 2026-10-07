import { asc, eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { StatusBadge, statusLabel } from "@/components/ui/status";
import { getDb } from "@/db";
import { agentRuns, organisations, RUN_OUTCOMES, runs } from "@/db/schema";
import { formatMicroUsd } from "@/integrations/ai/pricing";
import { kickJobs } from "@/jobs/kick";
import { fmtDateTime } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { RUN_KINDS } from "@/modules/runs/kinds";

export const metadata: Metadata = { title: "Run" };

const OUTCOME_HELP: Record<string, string> = {
  completed: "Done automatically",
  requires_approval: "Waiting for a decision",
  recommended: "Suggested for a person",
  blocked: "Needs something first",
  no_action: "Checked, nothing to do",
};

export default async function RunPage({ params }: PageProps<"/workspace/runs/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ r: runs, org: organisations.name })
    .from(runs)
    .innerJoin(organisations, eq(organisations.id, runs.organisationId))
    .where(eq(runs.id, id))
    .limit(1);
  if (!row) notFound();
  const { r, org } = row;
  await assertStaffClientAccess(ctx, r.organisationId);
  const agentRows = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.runId, id))
    .orderBy(asc(agentRuns.createdAt));
  const pending = r.status === "queued" || r.status === "running";
  if (pending) kickJobs();
  const kind = RUN_KINDS[r.kind as keyof typeof RUN_KINDS];

  return (
    <>
      {pending && <AutoRefresh />}
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/runs" className="hover:text-ink">
          Runs
        </Link>{" "}
        / {kind?.label ?? r.kind}
      </div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{kind?.label ?? r.kind}</h1>
          <StatusBadge kind="run" value={r.status} />
        </div>
        <p className="text-muted mt-1 text-sm">
          <Link
            href={`/workspace/clients/${r.organisationId}`}
            className="text-brand-700 decoration-brand-300 underline underline-offset-[3px] hover:decoration-current"
          >
            {org}
          </Link>{" "}
          · {r.trigger} · started {fmtDateTime(r.startedAt ?? r.createdAt)}
          {r.finishedAt && ` · finished ${fmtDateTime(r.finishedAt)}`} · AI cost{" "}
          {formatMicroUsd(r.costMicroUsd)}
        </p>
        {kind && <p className="text-ink-soft mt-2 max-w-3xl text-sm">{kind.description}</p>}
      </header>

      {pending ? (
        <Card>
          <CardBody className="flex items-center gap-3 py-10" role="status" aria-live="polite">
            <Loader2 className="text-brand-600 size-5 animate-spin" aria-hidden /> Running. This
            page updates automatically.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {r.error && (
            <Callout tone="danger" title="The run stopped">
              {r.error}
            </Callout>
          )}
          {r.summary && (
            <Card>
              <CardBody>
                <p className="text-lg">{r.summary.headline}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {RUN_OUTCOMES.map((o) => (
                    <div key={o} className="border-border rounded-lg border p-3">
                      <dd className="text-xl font-semibold tabular-nums">
                        {r.summary!.counts[o] ?? 0}
                      </dd>
                      <dt className="text-muted text-xs">{OUTCOME_HELP[o]}</dt>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="What happened" />
            <ul className="divide-border divide-y">
              {r.items.length === 0 && <li className="text-muted px-5 py-4 text-sm">No items.</li>}
              {r.items.map((item, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {item.link ? (
                        <Link href={item.link} className="hover:underline">
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </p>
                    {item.detail && <p className="text-muted mt-0.5 text-xs">{item.detail}</p>}
                    {item.agent && (
                      <p className="text-subtle mt-0.5 text-[0.7rem]">Agent: {item.agent}</p>
                    )}
                  </div>
                  <StatusBadge kind="outcome" value={item.outcome} />
                </li>
              ))}
            </ul>
          </Card>
          {agentRows.length > 0 && (
            <Card>
              <CardHeader
                title="Agent log"
                description="Every agent action in this run, with provider, model and cost."
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted text-left">
                    <tr className="border-border border-b">
                      <th className="px-5 py-2 font-medium">Agent</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-right font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((a) => (
                      <tr key={a.id} className="border-border border-b last:border-0">
                        <td className="px-5 py-2">{a.agent}</td>
                        <td className="px-3 py-2">{a.action}</td>
                        <td className="px-3 py-2">
                          {a.provider ? `${a.provider}${a.model ? ` · ${a.model}` : ""}` : "rules"}
                        </td>
                        <td className="px-3 py-2">
                          {statusLabel(a.status)}
                          {a.error ? `: ${a.error}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {a.inputTokens + a.outputTokens}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatMicroUsd(a.costMicroUsd)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(a.durationMs / 1000).toFixed(1)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
