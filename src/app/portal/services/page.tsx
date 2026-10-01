import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionForm, SubmitButton, TextArea } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { getDb } from "@/db";
import { clientServices, services } from "@/db/schema";
import { requireClient } from "@/modules/auth/context";
import { portalRequestServiceAction } from "../actions";

export const metadata: Metadata = { title: "Services" };

export default async function PortalServices() {
  const ctx = await requireClient();
  const db = await getDb();
  const mine = await db
    .select({ cs: clientServices, s: services })
    .from(clientServices)
    .innerJoin(services, eq(services.id, clientServices.serviceId))
    .where(
      and(
        eq(clientServices.organisationId, ctx.organisationId),
        inArray(clientServices.status, ["active", "paused", "pending"]),
      ),
    );
  const owned = mine.map((m) => m.s.id);
  const others = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.status, "active"),
        eq(services.showOnWebsite, true),
        owned.length ? notInArray(services.id, owned) : undefined,
      ),
    )
    .orderBy(asc(services.sortOrder));
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-ink text-3xl">Services</h1>
        <p className="text-muted mt-1">
          What&apos;s included in your plan, and what else we can help with.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {mine.map(({ cs, s }) => (
          <Card key={cs.id}>
            <CardHeader title={s.name} action={<StatusBadge kind="service" value={cs.status} />} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-ink-soft">{s.summary}</p>
              {cs.currentFocus && (
                <p>
                  <span className="font-medium">Current focus:</span> {cs.currentFocus}
                </p>
              )}
              {cs.status === "paused" && cs.pauseReason && (
                <p className="text-warning-700">{cs.pauseReason}</p>
              )}
              {s.deliverables.length > 0 && (
                <details>
                  <summary className="text-brand-700 cursor-pointer">What&apos;s included</summary>
                  <ul className="text-ink-soft mt-2 list-disc space-y-1 pl-5">
                    {s.deliverables.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </details>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      {others.length > 0 && (
        <Card>
          <CardHeader
            title="Interested in something else?"
            description="Ask, and we'll talk it through first. Nothing is added or billed without your agreement."
          />
          <ul className="divide-border divide-y">
            {others.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="text-muted block text-xs">{s.summary}</span>
                    </span>
                    <span className="text-brand-700 shrink-0 text-sm">Ask about this</span>
                  </summary>
                  <ActionForm action={portalRequestServiceAction} className="mt-3 space-y-2">
                    <input type="hidden" name="serviceId" value={s.id} />
                    <TextArea name="note" label="Anything we should know? (optional)" rows={2} />
                    <SubmitButton size="sm">Send request</SubmitButton>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
