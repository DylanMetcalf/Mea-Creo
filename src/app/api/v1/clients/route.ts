import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { clients } from "@/db/schema";
import { requireApiKey } from "@/modules/api-keys/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "read:clients");
  if ("error" in auth) return auth.error;
  const rows = await auth.db.select().from(clients).orderBy(asc(clients.name));
  return NextResponse.json({
    clients: rows.map((c) => ({
      id: c.organisationId,
      name: c.name,
      internal: c.isInternal,
      lifecycle: c.lifecycle,
      billingState: c.billingState,
      health: c.health,
      healthReasons: c.healthReasons,
      monthlyValueMinor: c.monthlyValueMinor,
      currency: c.currency,
      renewalDate: c.renewalDate,
    })),
  });
}
