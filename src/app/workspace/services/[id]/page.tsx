import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { AGENTS } from "@/agents/registry";
import { getDb } from "@/db";
import {
  APPROVAL_LEVELS,
  AUTOMATION_LEVELS,
  BILLING_TYPES,
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  services,
} from "@/db/schema";
import { humanize } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { requireStaff } from "@/modules/auth/context";
import { LEVEL_LABELS } from "@/modules/approvals/service";
import { RUN_KINDS } from "@/modules/runs/kinds";
import { CATEGORY_LABELS } from "@/modules/services/catalogue";
import { saveServiceAction } from "../actions";

export const metadata: Metadata = { title: "Service" };

const PRICE_FIELDS = [
  ["setupMinor", "Setup"],
  ["monthlyMinor", "Monthly"],
  ["oneOffMinor", "Once-off"],
  ["unitMinor", "Per unit"],
] as const;

export default async function ServicePage({ params }: PageProps<"/workspace/services/[id]">) {
  const ctx = await requireStaff();
  const { id } = await params;
  const [s] = await (await getDb()).select().from(services).where(eq(services.id, id)).limit(1);
  if (!s) notFound();
  const locked = !ctx.can("services.manage");
  const opts = (values: readonly string[], label: (v: string) => string = humanize) =>
    values.map((v) => ({ value: v, label: label(v) }));
  const agentName = new Map(AGENTS.map((a) => [a.id, a.name]));

  return (
    <>
      <div className="text-muted mb-2 text-sm">
        <Link href="/workspace/services" className="hover:text-ink">
          Services & pricing
        </Link>{" "}
        / {s.name}
      </div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{s.name}</h1>
      <ActionForm action={saveServiceAction} className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <input type="hidden" name="serviceId" value={s.id} />
        <div className="space-y-6">
          <Card>
            <CardHeader title="Description" />
            <CardBody className="space-y-4">
              <TextField
                name="name"
                label="Name"
                defaultValue={s.name}
                disabled={locked}
                required
              />
              <TextField
                name="summary"
                label="One-line summary"
                defaultValue={s.summary}
                disabled={locked}
              />
              <TextArea
                name="description"
                label="Description"
                defaultValue={s.description}
                rows={4}
                disabled={locked}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextArea
                  name="includedActivities"
                  label="Included activities"
                  defaultValue={s.includedActivities.join("\n")}
                  rows={6}
                  disabled={locked}
                />
                <TextArea
                  name="deliverables"
                  label="Deliverables"
                  defaultValue={s.deliverables.join("\n")}
                  rows={6}
                  disabled={locked}
                />
                <TextArea
                  name="kpis"
                  label="KPIs"
                  defaultValue={s.kpis.join("\n")}
                  rows={4}
                  disabled={locked}
                />
                <TextArea
                  name="limits"
                  label="Limits"
                  defaultValue={s.limits.join("\n")}
                  rows={4}
                  disabled={locked}
                />
                <TextArea
                  name="requiredInputs"
                  label="Needed from the client"
                  defaultValue={s.requiredInputs.join("\n")}
                  rows={4}
                  disabled={locked}
                />
                <TextArea
                  name="humanInvolvement"
                  label="Human involvement"
                  defaultValue={s.humanInvolvement}
                  rows={4}
                  disabled={locked}
                />
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Pricing"
              description="Excluding VAT. Leave blank where not applicable. Changes apply to new proposals and plans."
            />
            <CardBody className="space-y-4">
              {SUPPORTED_CURRENCIES.map((c) => (
                <fieldset key={c} className="grid grid-cols-[48px_1fr_1fr] items-center gap-2">
                  <legend className="sr-only">{c} prices</legend>
                  <span className="text-sm font-medium">{c}</span>
                  {PRICE_FIELDS.filter(([f]) =>
                    s.billingType === "monthly"
                      ? f !== "oneOffMinor" && f !== "unitMinor"
                      : s.billingType === "usage"
                        ? f === "unitMinor" || f === "setupMinor"
                        : f !== "monthlyMinor" && f !== "unitMinor",
                  ).map(([f, label]) => (
                    <input
                      key={f}
                      name={`price.${c}.${f}`}
                      aria-label={`${c} ${label}`}
                      placeholder={label}
                      defaultValue={s.prices[c]?.[f] ? String(s.prices[c]![f]! / 100) : ""}
                      inputMode="decimal"
                      disabled={locked}
                      className="border-border-strong bg-surface h-9 rounded-md border px-2 text-right text-sm tabular-nums"
                    />
                  ))}
                </fieldset>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="How it runs" />
            <CardBody className="space-y-3">
              <SelectField
                name="category"
                label="Category"
                defaultValue={s.category}
                options={opts(
                  SERVICE_CATEGORIES,
                  (v) => CATEGORY_LABELS[v as keyof typeof CATEGORY_LABELS],
                )}
              />
              <SelectField
                name="billingType"
                label="Billing"
                defaultValue={s.billingType}
                options={opts(BILLING_TYPES)}
              />
              <SelectField
                name="automationLevel"
                label="Automation"
                defaultValue={s.automationLevel}
                options={opts(AUTOMATION_LEVELS)}
              />
              <SelectField
                name="defaultApprovalLevel"
                label="Default approval"
                defaultValue={s.defaultApprovalLevel}
                options={opts(APPROVAL_LEVELS, (v) => LEVEL_LABELS[v as keyof typeof LEVEL_LABELS])}
              />
              <SelectField
                name="status"
                label="Status"
                defaultValue={s.status}
                options={opts(SERVICE_STATUSES)}
              />
              <CheckboxField
                name="showOnWebsite"
                label="Show on the website"
                defaultChecked={s.showOnWebsite}
              />
              <CheckboxField
                name="requiresStrategy"
                label="Needs a strategy conversation first"
                defaultChecked={s.requiresStrategy}
              />
              <CheckboxField
                name="selfService"
                label="Clients can request it from the portal"
                defaultChecked={s.selfService}
              />
              <DescriptionList
                items={[
                  [
                    "Run types",
                    s.runKinds
                      .map((k) => RUN_KINDS[k as keyof typeof RUN_KINDS]?.label ?? k)
                      .join(", ") || null,
                  ],
                  ["Agents", s.agents.map((a) => agentName.get(a) ?? a).join(", ") || null],
                  ["Integrations", s.requiredIntegrations.map(humanize).join(", ") || null],
                ]}
              />
              {!locked && <SubmitButton>Save service</SubmitButton>}
            </CardBody>
          </Card>
        </div>
      </ActionForm>
    </>
  );
}
