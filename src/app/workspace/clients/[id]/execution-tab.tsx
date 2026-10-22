import { Wrench } from "lucide-react";
import Link from "next/link";
import { Table } from "@/components/ui/feedback";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Badge, Card, CardBody, CardHeader, Callout, EmptyState } from "@/components/ui/primitives";
import { getDb } from "@/db";
import type { FixStatus } from "@/db/schema";
import { fmtRelative } from "@/lib/format";
import type { ClientDetail } from "@/modules/clients/queries";
import { CMS_LABELS } from "@/modules/execution/cms";
import { FIX_STATUS_LABELS, listFixes } from "@/modules/execution/service";
import { generateFixesAction } from "../execution-actions";
import {
  AREA_LABELS,
  ClassificationBadge,
  FixStatusBadge,
  PriorityBadge,
} from "@/components/execution/fix-badges";

const ORDER: FixStatus[] = ["review", "approved", "applied", "draft", "verified", "dismissed"];
const PRIORITY = { high: 0, medium: 1, low: 2 } as const;

/** The execution engine: finished, verifiable website fixes for this client. */
export async function ExecutionTab({ data, canRun }: { data: ClientDetail; canRun: boolean }) {
  const { client } = data;
  const all = await listFixes(await getDb(), client.organisationId);
  const counts = Object.fromEntries(
    ORDER.map((s) => [s, all.filter((f) => f.status === s).length]),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Website fixes"
          description={`Each fix is the finished change (exact text, code or file), where it goes, how to apply it on ${client.cms === "unknown" ? "the client's platform" : CMS_LABELS[client.cms]}, and how we check it's live.`}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ORDER.map((s) => (
              <Badge key={s} tone={counts[s] ? "brand" : "neutral"}>
                {FIX_STATUS_LABELS[s]} · {counts[s]}
              </Badge>
            ))}
          </div>
          {client.cms === "unknown" && (
            <Callout tone="warning" title="Website platform not recorded">
              Set it under Strategy &amp; Brain → Profile → Website platform to get exact steps for
              WordPress, Shopify, Wix or Squarespace.
            </Callout>
          )}
          {canRun &&
            (client.website ? (
              <ActionForm
                action={generateFixesAction.bind(null, client.organisationId)}
                className="space-y-2"
              >
                <p className="text-muted text-sm">
                  Reads the home page and up to seven linked pages of {client.website}, plus
                  robots.txt, the sitemap and llms.txt. Uses only verified Brain facts. Drafts you
                  haven&apos;t sent to review are refreshed; anything further along is left alone.
                </p>
                <SubmitButton pendingLabel="Reading the site…">
                  <Wrench className="size-4" aria-hidden /> Read site &amp; draft fixes
                </SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-muted text-sm">
                Add the client&apos;s website to the profile first.
              </p>
            ))}
        </CardBody>
      </Card>

      {all.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-5" />}
          title="No fixes yet"
          description="Read the site to draft the first set. Nothing reaches the client until it's approved."
        />
      ) : (
        ORDER.filter((s) => counts[s]).map((status) => (
          <section key={status} className="space-y-2">
            <h3 className="label-mono text-muted">
              {FIX_STATUS_LABELS[status]} · {counts[status]}
            </h3>
            <Table>
              <thead>
                <tr>
                  <th>Fix</th>
                  <th>Page</th>
                  <th>Area</th>
                  <th>Basis</th>
                  <th>Priority</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {all
                  .filter((f) => f.status === status)
                  .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])
                  .map((f) => (
                    <tr key={f.id} className="align-top">
                      <td className="min-w-56">
                        <Link
                          href={`/workspace/clients/${client.organisationId}/fixes/${f.id}`}
                          className="font-medium hover:underline"
                        >
                          {f.title}
                        </Link>
                        {status === "applied" &&
                          f.lastVerification &&
                          !f.lastVerification.passed && (
                            <p className="text-danger-700 text-xs">Last check: not live yet</p>
                          )}
                      </td>
                      <td className="text-muted max-w-48 truncate text-xs">
                        {new URL(f.pageUrl).pathname}
                      </td>
                      <td className="text-xs">{AREA_LABELS[f.area]}</td>
                      <td>
                        <ClassificationBadge value={f.classification} />
                      </td>
                      <td>
                        <PriorityBadge value={f.priority} />
                      </td>
                      <td className="text-muted text-xs whitespace-nowrap">
                        {fmtRelative(f.updatedAt)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </section>
        ))
      )}
      <p className="text-muted text-xs">
        <FixStatusBadge value="verified" /> means the engine re-read the live page and found the
        approved change. Rankings, traffic and AI citations are measured separately and never
        promised.
      </p>
    </div>
  );
}
