import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SelectField, SubmitButton, TextArea, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { packageItems, packages, SERVICE_STATUSES, services } from "@/db/schema";
import { fmtMoney, humanize } from "@/lib/format";
import { requireStaff } from "@/modules/auth/context";
import { savePackageAction } from "../../actions";

export const metadata: Metadata = { title: "Package" };

export default async function PackagePage({
  params,
}: PageProps<"/workspace/services/packages/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const db = await getDb();
  const [p] = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  if (!p) notFound();
  const [items, all] = await Promise.all([
    db.select().from(packageItems).where(eq(packageItems.packageId, id)),
    db.select().from(services).where(eq(services.status, "active")).orderBy(asc(services.name)),
  ]);
  const included = new Set(items.map((i) => i.serviceId));
  const monthly = all
    .filter((s) => included.has(s.id))
    .reduce((sum, s) => sum + (s.prices.ZAR?.monthlyMinor ?? 0), 0);
  const locked = !ctx.can("services.manage");

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/services" className="hover:text-ink">
          Services & pricing
        </Link>{" "}
        / {p.name}
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{p.name}</h1>
      <ActionForm
        action={savePackageAction}
        className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <input type="hidden" name="packageId" value={p.id} />
        <Card>
          <CardHeader title="Package" />
          <CardBody className="space-y-4">
            <TextField name="name" label="Name" defaultValue={p.name} disabled={locked} />
            <TextArea
              name="description"
              label="Description"
              defaultValue={p.description}
              rows={4}
              disabled={locked}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                name="contractMonths"
                type="number"
                label="Minimum months"
                defaultValue={String(p.contractMonths)}
                disabled={locked}
              />
              <TextField
                name="discountPercent"
                type="number"
                label="Monthly discount %"
                defaultValue={String(p.discountPercent)}
                disabled={locked}
              />
            </div>
            <TextArea
              name="terms"
              label="Terms"
              defaultValue={p.terms ?? ""}
              rows={4}
              disabled={locked}
            />
            <SelectField
              name="status"
              label="Status"
              defaultValue={p.status}
              options={SERVICE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Included services"
            description={
              monthly
                ? `Catalogue monthly total ${fmtMoney(monthly)}, ${fmtMoney(Math.round(monthly * (1 - p.discountPercent / 100)))} after discount (ZAR, excl. VAT).`
                : "Prices not set yet."
            }
          />
          <CardBody>
            <fieldset className="space-y-2">
              <legend className="sr-only">Services</legend>
              {all.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={s.id}
                    defaultChecked={included.has(s.id)}
                    disabled={locked}
                    className="accent-brand-700 size-4"
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
            {!locked && (
              <div className="mt-4">
                <SubmitButton>Save package</SubmitButton>
              </div>
            )}
          </CardBody>
        </Card>
      </ActionForm>
    </>
  );
}
