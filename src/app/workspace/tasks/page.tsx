import { and, asc, desc, eq, inArray, isNull, lt, ne, or, type SQL, sql } from "drizzle-orm";
import { Check, ListTodo } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { DueLabel, StatusBadge, statusLabel } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { getDb } from "@/db";
import {
  clients,
  OPEN_TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  tasks,
  users,
} from "@/db/schema";
import { humanize } from "@/lib/format";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { listStaff } from "@/modules/team/service";
import { completeTaskAction, createTaskAction, setTaskStatusAction } from "./actions";

export const metadata: Metadata = { title: "Tasks" };

const VIEWS = ["mine", "open", "overdue", "unassigned", "waiting", "done"] as const;

export default async function TasksPage({ searchParams }: PageProps<"/workspace/tasks">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v === sp.tab) ?? "mine";
  const clientFilter = typeof sp.client === "string" ? sp.client : undefined;
  const focus = typeof sp.task === "string" ? sp.task : undefined;
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const clientRows = await db
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
    .orderBy(asc(clients.name));
  clientRows.unshift({ organisationId: ctx.platformOrganisationId, name: "Mea Creo (internal)" });
  const orgIds = clientRows.map((c) => c.organisationId);
  const viewFilter: Record<(typeof VIEWS)[number], SQL | undefined> = {
    mine: and(eq(tasks.assigneeId, ctx.user.id), inArray(tasks.status, OPEN_TASK_STATUSES)),
    open: inArray(tasks.status, OPEN_TASK_STATUSES),
    overdue: and(inArray(tasks.status, OPEN_TASK_STATUSES), lt(tasks.dueAt, new Date())),
    unassigned: and(
      isNull(tasks.assigneeId),
      isNull(tasks.agent),
      inArray(tasks.status, OPEN_TASK_STATUSES),
    ),
    waiting: inArray(tasks.status, ["waiting", "waiting_client", "waiting_approval", "blocked"]),
    done: eq(tasks.status, "complete"),
  };
  const rows = orgIds.length
    ? await db
        .select({ task: tasks, assignee: users.name })
        .from(tasks)
        .leftJoin(users, eq(users.id, tasks.assigneeId))
        .where(
          and(
            inArray(
              tasks.organisationId,
              clientFilter ? [clientFilter].filter((c) => orgIds.includes(c)) : orgIds,
            ),
            focus ? or(eq(tasks.id, focus), viewFilter[view]) : viewFilter[view],
          ),
        )
        .orderBy(
          view === "done" ? desc(tasks.completedAt) : sql`${tasks.dueAt} asc nulls last`,
          desc(tasks.createdAt),
        )
        .limit(300)
    : [];
  const clientName = new Map(clientRows.map((c) => [c.organisationId, c.name]));
  const staff = await listStaff(db, ctx.platformOrganisationId);
  const base = `/workspace/tasks${clientFilter ? `?client=${clientFilter}` : ""}`;

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Work for people and agents across every client. Items visible to the client appear in their portal."
      />
      <Tabs
        baseHref={base}
        active={view}
        tabs={VIEWS.map((v) => ({ key: v, label: v === "mine" ? "My tasks" : humanize(v) }))}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          {clientFilter && (
            <p className="mb-3 text-sm">
              Client: {clientName.get(clientFilter) ?? "Unknown"} ·{" "}
              <Link href={`/workspace/tasks?tab=${view}`} className="text-brand-700 underline">
                all clients
              </Link>
            </p>
          )}
          {rows.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="size-6" />}
              title="Nothing here"
              description={view === "mine" ? "No open tasks assigned to you." : undefined}
            />
          ) : (
            <Card>
              <ul className="divide-border divide-y">
                {rows.map(({ task, assignee }) => (
                  <li
                    key={task.id}
                    id={task.id}
                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${task.id === focus ? "bg-brand-50" : ""}`}
                  >
                    {task.status !== "complete" && ctx.can("tasks.write") ? (
                      <form action={completeTaskAction.bind(null, task.id)}>
                        <button
                          className="border-border-strong hover:border-brand-700 hover:text-brand-700 flex size-6 items-center justify-center rounded-full border text-transparent"
                          aria-label={`Complete ${task.title}`}
                        >
                          <Check className="size-3.5" aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <span className="bg-success-100 text-success-700 flex size-6 items-center justify-center rounded-full">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-muted text-xs">
                        <Link
                          href={`/workspace/clients/${task.organisationId}?tab=work`}
                          className="hover:underline"
                        >
                          {clientName.get(task.organisationId)}
                        </Link>{" "}
                        · {assignee ?? (task.agent ? `Agent: ${task.agent}` : "Unassigned")} ·{" "}
                        {task.visibility === "client" ? "client-visible" : "internal"}
                        {task.priority !== "normal" && ` · ${task.priority} priority`}
                      </p>
                      {task.description && task.id === focus && (
                        <p className="text-ink-soft mt-2 text-sm whitespace-pre-line">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <DueLabel due={task.dueAt} done={task.status === "complete"} />
                      {ctx.can("tasks.write") ? (
                        <form
                          action={setTaskStatusAction.bind(null, task.id)}
                          className="flex items-center gap-1"
                        >
                          <label className="sr-only" htmlFor={`s-${task.id}`}>
                            Status
                          </label>
                          <select
                            id={`s-${task.id}`}
                            name="status"
                            defaultValue={task.status}
                            className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ))}
                          </select>
                          <SubmitButton size="sm" variant="ghost">
                            Set
                          </SubmitButton>
                        </form>
                      ) : (
                        <StatusBadge kind="task" value={task.status} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        {ctx.can("tasks.write") && (
          <Card className="h-fit" id="new">
            <CardHeader title="New task" />
            <CardBody>
              <ActionForm action={createTaskAction} className="space-y-3" resetOnSuccess>
                <SelectField
                  name="organisationId"
                  label="Client"
                  defaultValue={clientFilter}
                  options={clientRows.map((c) => ({ value: c.organisationId, label: c.name }))}
                  required
                />
                <TextField name="title" label="Title" required />
                <TextArea name="description" label="Details" rows={3} />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    name="assigneeId"
                    label="Assignee"
                    placeholder="Unassigned"
                    defaultValue={ctx.user.id}
                    options={staff.map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <TextField name="dueAt" type="date" label="Due" />
                  <SelectField
                    name="priority"
                    label="Priority"
                    defaultValue="normal"
                    options={TASK_PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))}
                  />
                  <SelectField
                    name="visibility"
                    label="Visible to"
                    options={[
                      { value: "internal", label: "Team only" },
                      { value: "client", label: "Client too" },
                    ]}
                  />
                </div>
                <SubmitButton>Add task</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
