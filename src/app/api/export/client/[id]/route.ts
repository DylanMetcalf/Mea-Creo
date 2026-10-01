import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  approvals,
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  competitors,
  contacts,
  documents,
  invoiceLines,
  invoices,
  meetings,
  messages,
  notes,
  organisations,
  payments,
  reports,
  tasks,
  timelineEntries,
} from "@/db/schema";
import { logActivity, userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, getAuthContext } from "@/modules/auth/context";

export const dynamic = "force-dynamic";

/** Full JSON export of one client's record (POPIA access requests, backups). Staff with data.export only. */
export async function GET(_request: Request, { params }: RouteContext<"/api/export/client/[id]">) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.kind !== "staff" || !ctx.can("data.export"))
    return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  await assertStaffClientAccess(ctx, id);
  const db = await getDb();
  const [org] = await db.select().from(organisations).where(eq(organisations.id, id));
  if (!org) return new NextResponse("Not found", { status: 404 });
  const by = <T extends { organisationId: unknown }>(table: T) =>
    eq(table.organisationId as never, id);
  const invoiceRows = await db.select().from(invoices).where(by(invoices));
  const lines = invoiceRows.length
    ? await Promise.all(
        invoiceRows.map((i) =>
          db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, i.id)),
        ),
      )
    : [];
  const data = {
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.user.email,
    organisation: org,
    client: (await db.select().from(clients).where(by(clients)))[0] ?? null,
    contacts: await db.select().from(contacts).where(by(contacts)),
    clientBrain: await db.select().from(clientBrainFacts).where(by(clientBrainFacts)),
    goals: await db.select().from(clientGoals).where(by(clientGoals)),
    competitors: await db.select().from(competitors).where(by(competitors)),
    services: await db.select().from(clientServices).where(by(clientServices)),
    tasks: await db.select().from(tasks).where(by(tasks)),
    approvals: await db.select().from(approvals).where(by(approvals)),
    reports: await db.select().from(reports).where(by(reports)),
    meetings: await db.select().from(meetings).where(by(meetings)),
    messages: await db.select().from(messages).where(by(messages)),
    notes: await db.select().from(notes).where(by(notes)),
    timeline: await db.select().from(timelineEntries).where(by(timelineEntries)),
    documents: (await db.select().from(documents).where(by(documents))).map((d) => ({
      ...d,
      note: "File contents are downloadable separately from the Documents tab.",
    })),
    invoices: invoiceRows.map((i, n) => ({ ...i, lines: lines[n] ?? [] })),
    payments: (await db.select().from(payments).where(by(payments))).map(
      ({ raw: _raw, ...p }) => p,
    ),
  };
  await logActivity(db, userActor(ctx.user), {
    organisationId: id,
    action: "data.exported",
    summary: `Exported all data for ${org.name}`,
  });
  const filename = `${org.name.replace(/[^\w-]+/g, "-").toLowerCase()}-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
