import { and, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DueLabel, StatusBadge, statusLabel } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { getDb } from "@/db";
import { approvals, organisations } from "@/db/schema";
import { fmtRelative } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { LEVEL_LABELS } from "@/modules/approvals/service";

export const metadata: Metadata = { title: "Approvals" };

const TABS = ["ours", "client", "decided"] as const;

export default async function ApprovalsPage({ searchParams }: PageProps<"/workspace/approvals">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "ours";
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const scoped: SQL | undefined =
    scope === "all"
      ? undefined
      : inArray(
          approvals.organisationId,
          scope.length ? scope : ["00000000-0000-0000-0000-000000000000"],
        );
  const filters: Record<(typeof TABS)[number], SQL | undefined> = {
    ours: and(eq(approvals.status, "pending"), inArray(approvals.level, ["internal", "manual"])),
    client: and(eq(approvals.status, "pending"), eq(approvals.level, "client")),
    decided: ne(approvals.status, "pending"),
  };
  const counts = await Promise.all(
    TABS.map((t) =>
      t === "decided"
        ? Promise.resolve([])
        : db.select({ id: approvals.id }).from(approvals).where(and(filters[t], scoped)),
    ),
  );
  const rows = await db
    .select({ a: approvals, org: organisations.name })
    .from(approvals)
    .innerJoin(organisations, eq(organisations.id, approvals.organisationId))
    .where(and(filters[tab], scoped))
    .orderBy(desc(approvals.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Nothing marked for approval happens until a person decides. Automatic items never appear here; they run and are logged."
      />
      <Tabs
        baseHref="/workspace/approvals"
        active={tab}
        tabs={[
          { key: "ours", label: "Needs Mea Creo", count: counts[0].length },
          { key: "client", label: "Waiting on clients", count: counts[1].length },
          { key: "decided", label: "Decided" },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" />}
          title={tab === "ours" ? "Nothing waiting on you" : "Nothing here"}
          description={
            tab === "ours"
              ? "New items appear when agents, runs or the team request a decision."
              : undefined
          }
        />
      ) : (
        <Card>
          <ul className="divide-border divide-y">
            {rows.map(({ a, org }) => (
              <li key={a.id}>
                <Link
                  href={`/workspace/approvals/${a.id}`}
                  className="hover:bg-surface-2 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-muted text-xs">
                      {org} · {statusLabel(a.type)} ·{" "}
                      {a.requestedByAgent
                        ? `requested by ${a.requestedByAgent} agent`
                        : "requested by the team"}{" "}
                      · {fmtRelative(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.status === "pending" && a.dueAt && <DueLabel due={a.dueAt} />}
                    <Badge tone="neutral">{LEVEL_LABELS[a.level]}</Badge>
                    <StatusBadge kind="approval" value={a.status} />
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
