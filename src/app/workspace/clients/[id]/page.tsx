import { ChevronDown, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { HealthLabel, StatusBadge } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { getDb } from "@/db";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { assertStaffClientAccess, requireStaff } from "@/modules/auth/context";
import { clientDetail } from "@/modules/clients/queries";
import { RUN_KINDS } from "@/modules/runs/kinds";
import { runClientAction } from "../actions";
import {
  ActivityTab,
  BillingTab,
  DocumentsTab,
  MeetingsTab,
  MessagesTab,
  OverviewTab,
  ReportsTab,
  ServicesTab,
  SettingsTab,
  StrategyTab,
  VisibilityTab,
  WorkTab,
} from "./tabs";

export async function generateMetadata({
  params,
}: PageProps<"/workspace/clients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await clientDetail(await getDb(), id);
  return { title: data?.client.name ?? "Client" };
}

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/workspace/clients/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const tab = String((await searchParams).tab ?? "overview");
  try {
    await assertStaffClientAccess(ctx, id);
  } catch {
    notFound();
  }
  const db = await getDb();
  const data = await clientDetail(db, id);
  if (!data) notFound();
  const { client } = data;
  const activeServices = data.services.filter((s) => s.cs.status === "active");
  const pendingApprovals = data.approvals.filter((a) => a.status === "pending").length;
  const openTasks = data.tasks.filter(
    (t) => !["complete", "cancelled"].includes(t.task.status),
  ).length;
  const unreadMessages = data.messages.filter(
    (m) => m.message.fromClient && !m.message.readByStaffAt,
  ).length;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "strategy", label: "Strategy & Brain" },
    { key: "work", label: "Work", count: openTasks },
    { key: "services", label: "Services", count: activeServices.length },
    { key: "visibility", label: "SEO & AI visibility" },
    { key: "meetings", label: "Meetings" },
    { key: "documents", label: "Documents" },
    {
      key: "reports",
      label: "Reports",
      count: data.reports.filter((r) => r.status === "in_review").length,
    },
    { key: "billing", label: "Billing" },
    { key: "messages", label: "Messages", count: unreadMessages },
    { key: "activity", label: "Timeline & activity" },
    { key: "settings", label: "People & settings" },
  ];

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/clients" className="hover:text-ink">
          Clients
        </Link>{" "}
        / {client.name}
      </div>
      <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            {client.isInternal && <Badge tone="brand">Mea Creo&apos;s own account</Badge>}
            {data.org.isDemo && <Badge tone="warning">Demo</Badge>}
            {client.automationPaused && <Badge tone="danger">Automation paused</Badge>}
          </div>
          <p className="text-muted mt-1 text-sm">
            {[client.industry, client.location, client.website?.replace(/^https?:\/\//, "")]
              .filter(Boolean)
              .join(" · ") || "Profile incomplete"}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <dt className="text-muted text-xs">Health</dt>
              <dd className="mt-0.5">
                <HealthLabel value={client.health} />
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Monthly value</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {client.isInternal
                  ? "Internal"
                  : fmtMoney(client.monthlyValueMinor, client.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Services</dt>
              <dd className="mt-0.5">{activeServices.length} active</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Owner</dt>
              <dd className="mt-0.5">{data.managerName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Billing</dt>
              <dd className="mt-0.5">
                {client.isInternal ? (
                  "-"
                ) : (
                  <StatusBadge kind="billing" value={client.billingState} />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Next meeting</dt>
              <dd className="mt-0.5">
                {data.nextMeeting ? (
                  <Link
                    href={`/workspace/meetings/${data.nextMeeting.id}`}
                    className="hover:underline"
                  >
                    {fmtDateTime(data.nextMeeting.startsAt)}
                  </Link>
                ) : (
                  "None booked"
                )}
              </dd>
            </div>
          </dl>
        </div>
        {ctx.can("runs.execute") && (
          <div className="flex shrink-0 items-start gap-2">
            <form action={runClientAction}>
              <input type="hidden" name="organisationId" value={id} />
              <input type="hidden" name="kind" value="client_growth_review" />
              <SubmitButton pendingLabel="Starting…">
                <Play className="size-4" aria-hidden /> Run Growth
              </SubmitButton>
            </form>
            <details className="relative">
              <summary className="border-border-strong bg-surface hover:bg-surface-2 inline-flex h-10 cursor-pointer list-none items-center gap-1 rounded-lg border px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                More runs <ChevronDown className="size-4" aria-hidden />
              </summary>
              <div className="rounded-card border-border bg-surface shadow-raised absolute right-0 z-20 mt-2 w-80 border p-1">
                {Object.entries(RUN_KINDS)
                  .filter(([k]) => k !== "client_growth_review")
                  .map(([kind, def]) => (
                    <form key={kind} action={runClientAction}>
                      <input type="hidden" name="organisationId" value={id} />
                      <input type="hidden" name="kind" value={kind} />
                      <button
                        type="submit"
                        className="hover:bg-surface-2 block w-full rounded-md px-3 py-2 text-left"
                      >
                        <span className="block text-sm font-medium">{def.label}</span>
                        <span className="text-muted block text-xs">{def.description}</span>
                      </button>
                    </form>
                  ))}
              </div>
            </details>
          </div>
        )}
      </header>

      <Tabs tabs={tabs} active={tab} baseHref={`/workspace/clients/${id}`} />

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "strategy" && <StrategyTab data={data} />}
      {tab === "work" && <WorkTab data={data} />}
      {tab === "services" && <ServicesTab data={data} canManage={ctx.can("services.manage")} />}
      {tab === "visibility" && <VisibilityTab data={data} />}
      {tab === "meetings" && <MeetingsTab data={data} />}
      {tab === "documents" && <DocumentsTab data={data} />}
      {tab === "reports" && <ReportsTab data={data} />}
      {tab === "billing" && <BillingTab data={data} />}
      {tab === "messages" && <MessagesTab data={data} />}
      {tab === "activity" && <ActivityTab data={data} />}
      {tab === "settings" && <SettingsTab data={data} canDelete={ctx.can("clients.delete")} />}
    </>
  );
}
