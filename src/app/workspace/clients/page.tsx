import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { HealthLabel, StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { fmtMoney } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { listClients } from "@/modules/clients/queries";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/workspace/clients">) {
  const ctx = await requireStaff();
  const params = await searchParams;
  const health = typeof params.health === "string" ? params.health : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;
  const rows = await listClients(await getDb(), await staffClientScope(ctx), { health, q });
  const filters = [
    ["", "All"],
    ["healthy", "Healthy"],
    ["watch", "Watch"],
    ["at_risk", "At risk"],
    ["paused", "Paused"],
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every client has a dedicated workspace: profile, Client Brain, services, work, reports and billing."
        actions={
          ctx.can("clients.write") && (
            <LinkButton href="/workspace/clients/new">
              <Plus className="size-4" aria-hidden /> Add client
            </LinkButton>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/workspace/clients?health=${value}` : "/workspace/clients"}
            className={`rounded-full px-3 py-1 text-sm ${health === value || (!health && !value) ? "bg-brand-700 text-white" : "bg-surface text-ink-soft ring-border hover:bg-surface-2 ring-1"}`}
          >
            {label}
          </Link>
        ))}
        <form className="ml-auto">
          <label className="sr-only" htmlFor="client-search">
            Search clients
          </label>
          <input
            id="client-search"
            name="q"
            defaultValue={q}
            placeholder="Search clients…"
            className="border-border bg-surface h-9 rounded-lg border px-3 text-sm"
          />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={health || q ? "No clients match" : "No clients yet"}
          description={
            health || q
              ? "Try a different filter."
              : "Add your first client, or accept a proposal to create one automatically."
          }
          action={
            ctx.can("clients.write") && (
              <LinkButton href="/workspace/clients/new">Add your first client</LinkButton>
            )
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-border text-muted border-b text-left text-xs tracking-wide uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-3 py-3 font-medium">Health</th>
                <th className="px-3 py-3 font-medium">Services</th>
                <th className="px-3 py-3 text-right font-medium">Monthly</th>
                <th className="px-3 py-3 font-medium">Billing</th>
                <th className="px-3 py-3 text-right font-medium">Open work</th>
                <th className="px-5 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link
                      href={`/workspace/clients/${c.organisationId}`}
                      className="text-ink font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="text-muted mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {c.industry ?? "Industry not set"}
                      {c.isInternal && <Badge tone="brand">Mea Creo&apos;s own account</Badge>}
                      {c.lifecycle === "onboarding" && <Badge tone="info">Onboarding</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <HealthLabel value={c.health} />
                  </td>
                  <td className="text-ink-soft max-w-[16rem] px-3 py-3 text-xs">
                    {c.services.length ? (
                      c.services.join(", ")
                    ) : (
                      <span className="text-subtle">None</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.isInternal ? "-" : fmtMoney(c.monthlyValueMinor, c.currency)}
                  </td>
                  <td className="px-3 py-3">
                    {c.isInternal ? (
                      <span className="text-subtle">-</span>
                    ) : (
                      <StatusBadge kind="billing" value={c.billingState} />
                    )}
                  </td>
                  <td className="text-muted px-3 py-3 text-right text-xs">
                    {c.openTasks} tasks
                    {c.pendingApprovals ? ` · ${c.pendingApprovals} approvals` : ""}
                  </td>
                  <td className="text-ink-soft px-5 py-3">
                    {c.managerName ?? <span className="text-subtle">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
