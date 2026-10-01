import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/form";
import { Badge, Callout, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { packageItems, packages, type ServicePrice, services } from "@/db/schema";
import { fmtMoney, humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { LEVEL_LABELS } from "@/modules/approvals/service";
import { CATEGORY_LABELS } from "@/modules/services/catalogue";
import { getPlatformSetting } from "@/modules/settings/service";
import { confirmPricesAction } from "./actions";

export const metadata: Metadata = { title: "Services & pricing" };

function priceText(p: ServicePrice | undefined, billingType: string) {
  if (!p) return <span className="text-warning-700">Not priced</span>;
  const parts = [
    p.setupMinor ? `${fmtMoney(p.setupMinor)} setup` : null,
    p.monthlyMinor ? `${fmtMoney(p.monthlyMinor)}/mo` : null,
    p.oneOffMinor ? fmtMoney(p.oneOffMinor) : null,
    p.unitMinor ? `${fmtMoney(p.unitMinor)}/unit` : null,
  ].filter(Boolean);
  if (!parts.length)
    return (
      <span className="text-warning-700">
        {billingType === "on_request" ? "On request" : "Not priced"}
      </span>
    );
  return parts.join(" + ");
}

export default async function ServicesPage() {
  const ctx = await requireStaff();
  const db = await getDb();
  const [rows, pkgs, items, billing] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name)),
    db.select().from(packages).orderBy(asc(packages.sortOrder)),
    db.select().from(packageItems),
    getPlatformSetting(db, "billing"),
  ]);
  const byCategory = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
    items: rows.filter((s) => s.category === key),
  }));
  const name = new Map(rows.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="Services & pricing"
        description="The catalogue drives proposals, client plans, RUN buttons, agents and the website. Prices are yours to set; nothing is invented."
      />
      {billing.pricesAreDemo && (
        <div className="mb-6">
          <Callout
            tone="warning"
            title="Prices are demo placeholders"
            action={
              ctx.can("services.manage") && (
                <form action={confirmPricesAction}>
                  <SubmitButton size="sm" variant="secondary">
                    I&apos;ve set real prices
                  </SubmitButton>
                </form>
              )
            }
          >
            Edit each service&apos;s price, then confirm. Until then, invoices and proposals carry a
            demo warning.
          </Callout>
        </div>
      )}
      <div className="space-y-6">
        {byCategory
          .filter((c) => c.items.length)
          .map((c) => (
            <Card key={c.key}>
              <CardHeader title={c.label} />
              <ul className="divide-border divide-y">
                {c.items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/workspace/services/${s.id}`}
                      className="hover:bg-surface-2 flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {s.name}
                          {s.status !== "active" && (
                            <Badge tone="neutral">{humanize(s.status)}</Badge>
                          )}
                        </span>
                        <span className="text-muted block text-xs">
                          {humanize(s.billingType)} · {humanize(s.automationLevel)} ·{" "}
                          {LEVEL_LABELS[s.defaultApprovalLevel]} · {s.runKinds.length} run types
                        </span>
                      </span>
                      <span className="text-sm tabular-nums">
                        {priceText(s.prices.ZAR, s.billingType)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        <Card>
          <CardHeader
            title="Packages"
            description="Bundles offered in proposals. Discounts apply to monthly fees."
          />
          <ul className="divide-border divide-y">
            {pkgs.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/workspace/services/packages/${p.id}`}
                  className="hover:bg-surface-2 block px-5 py-3"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {p.name}{" "}
                    {p.status !== "active" && <Badge tone="neutral">{humanize(p.status)}</Badge>}
                  </span>
                  <span className="text-muted block text-xs">
                    {p.contractMonths} months · {p.discountPercent}% monthly discount ·{" "}
                    {items
                      .filter((i) => i.packageId === p.id)
                      .map((i) => name.get(i.serviceId))
                      .join(", ") || "no services"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
