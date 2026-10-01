import { and, asc, inArray, ne } from "drizzle-orm";
import type { Metadata } from "next";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/ui/form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { requireStaff, staffClientScope } from "@/modules/auth/context";
import { getPlatformSetting } from "@/modules/settings/service";
import { createInvoiceAction } from "../actions";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: PageProps<"/workspace/billing/new">) {
  const ctx = await requireStaff("billing.manage");
  const sp = await searchParams;
  const scope = await staffClientScope(ctx);
  const db = await getDb();
  const [rows, billing] = await Promise.all([
    db
      .select({ id: clients.organisationId, name: clients.name, currency: clients.currency })
      .from(clients)
      .where(
        and(
          ne(clients.lifecycle, "offboarded"),
          scope === "all" ? undefined : inArray(clients.organisationId, scope),
        ),
      )
      .orderBy(asc(clients.name)),
    getPlatformSetting(db, "billing"),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New invoice"
        description={
          billing.vatRegistered
            ? `VAT at ${billing.taxRatePercent}% is added automatically.`
            : "VAT is not added: the business is set as not VAT registered (Settings → Billing)."
        }
      />
      <Card className="p-6">
        <ActionForm action={createInvoiceAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="organisationId"
              label="Client"
              defaultValue={typeof sp.client === "string" ? sp.client : undefined}
              options={rows.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <SelectField
              name="kind"
              label="Type"
              options={[
                { value: "once_off", label: "Once-off" },
                { value: "setup", label: "Setup" },
                { value: "monthly", label: "Monthly" },
                { value: "adjustment", label: "Adjustment" },
              ]}
            />
            <SelectField
              name="currency"
              label="Currency"
              defaultValue={billing.defaultCurrency}
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <TextField
              name="dueInDays"
              type="number"
              label="Due in (days)"
              defaultValue={String(billing.paymentTermsDays)}
            />
          </div>
          <TextField name="description" label="Description (optional)" />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Lines</legend>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_130px] gap-2">
                <input
                  name={`line.${i}.description`}
                  aria-label={`Line ${i + 1} description`}
                  placeholder={i === 0 ? "Description" : ""}
                  className="border-border-strong bg-surface h-10 rounded-lg border px-3 text-sm"
                />
                <input
                  name={`line.${i}.quantity`}
                  aria-label={`Line ${i + 1} quantity`}
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="border-border-strong bg-surface h-10 rounded-lg border px-2 text-right text-sm"
                />
                <input
                  name={`line.${i}.amount`}
                  aria-label={`Line ${i + 1} unit amount`}
                  inputMode="decimal"
                  placeholder={i === 0 ? "Unit amount" : ""}
                  className="border-border-strong bg-surface h-10 rounded-lg border px-3 text-right text-sm tabular-nums"
                />
              </div>
            ))}
          </fieldset>
          <CheckboxField
            name="issue"
            label="Issue now (visible to the client and payable)"
            defaultChecked
          />
          <SubmitButton>Create invoice</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
