import { desc, eq, isNull } from "drizzle-orm";
import { CheckCircle2, CircleAlert, CircleDashed, CircleX, Download } from "lucide-react";
import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  PageHeader,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { LEGAL_DOCS } from "@/content/legal";
import { getDb } from "@/db";
import {
  activityLog,
  apiKeys,
  APPROVAL_LEVELS,
  APPROVAL_TYPES,
  emailLog,
  memberships,
  users,
} from "@/db/schema";
import { integrationHealth } from "@/integrations/registry";
import type { IntegrationHealth } from "@/integrations/types";
import { fmtDateTime, humanize } from "@/lib/format";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { API_SCOPES } from "@/modules/api-keys/service";
import { getBankDetails, maskAccountNumber } from "@/modules/banking/service";
import { requireStaff } from "@/modules/auth/context";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/modules/auth/permissions";
import { HARD_LOCKED_ACTIONS, HARD_LOCKED_TYPES, LEVEL_LABELS } from "@/modules/approvals/service";
import { getPlatformSetting } from "@/modules/settings/service";
import { WORKFLOW_RULES } from "@/modules/workflows/engine";
import {
  createApiKeyAction,
  inviteStaffAction,
  revokeApiKeyAction,
  saveAiAction,
  saveAutomationAction,
  saveBankDetailsAction,
  saveBillingAction,
  saveBookingAction,
  saveCompanyAction,
  saveLegalReviewAction,
  saveEmergencyAction,
  saveOutreachAction,
  saveQaChecklistAction,
  saveQualificationAction,
  saveTargetsAction,
  updateStaffAction,
} from "./actions";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  ["company", "Company"],
  ["billing", "Billing"],
  ["booking", "Availability"],
  ["approvals", "Approvals & workflows"],
  ["ai", "AI & costs"],
  ["emergency", "Emergency"],
  ["team", "Team"],
  ["integrations", "Integrations"],
  ["api", "API keys"],
  ["email", "Email log"],
  ["activity", "Activity log"],
  ["business", "Targets"],
  ["prospecting", "Prospecting"],
  ["quality", "Quality"],
  ["data", "Data"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Approval actions people can tune. Anything not listed falls back to its approval type. */
const ACTION_ROWS = [
  ["report.publish", "Publish a client report"],
  ["content.approve", "Approve content for scheduling"],
  ["outreach.send", "Send outreach or follow-up emails"],
  ["task.create", "Create tasks from recommendations"],
  ...APPROVAL_TYPES.map(
    (t) =>
      [
        t,
        t === "other" ? "Anything else" : `Other ${humanize(t).toLowerCase()} approvals`,
      ] as const,
  ),
] as const;

const INTEGRATION_LABELS: Record<string, { name: string; env: string }> = {
  payments: {
    name: "Payments (Payfast)",
    env: "PAYMENT_PROVIDER=payfast, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX",
  },
  accounting: {
    name: "Accounting (Xero)",
    env: "ACCOUNTING_PROVIDER=xero, XERO_CLIENT_ID, XERO_CLIENT_SECRET",
  },
  email: {
    name: "Email (Resend or SMTP)",
    env: "EMAIL_PROVIDER=resend + RESEND_API_KEY, or EMAIL_PROVIDER=smtp + SMTP_*",
  },
  ai: { name: "AI (Anthropic)", env: "AI_PROVIDER=anthropic, ANTHROPIC_API_KEY" },
  storage: { name: "File storage", env: "STORAGE_PROVIDER=local or s3 + S3_*" },
  calendar: {
    name: "Calendar (Google)",
    env: "CALENDAR_PROVIDER=google, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
  },
  analytics: { name: "Analytics (GA4)", env: "ANALYTICS_PROVIDER=google + Google OAuth" },
  search: { name: "Search Console", env: "SEARCH_PROVIDER=google + Google OAuth" },
  crm: {
    name: "Sales Scout / CRM",
    env: "CRM_PROVIDER=sales_scout, SALES_SCOUT_WEBHOOK_SECRET (POST signed leads to /api/webhooks/sales-scout)",
  },
  social: {
    name: "Social (LinkedIn)",
    env: "SOCIAL_PROVIDER (assisted only; no automated LinkedIn actions)",
  },
};

function StatusIcon({ h }: { h: IntegrationHealth }) {
  if (h.status === "CONNECTED" && !h.mock)
    return <CheckCircle2 className="text-success-700 size-4" aria-hidden />;
  if (h.status === "CONNECTED")
    return <CircleDashed className="text-warning-700 size-4" aria-hidden />;
  if (h.status === "ERROR") return <CircleX className="text-danger-700 size-4" aria-hidden />;
  if (h.status === "ACTION_REQUIRED")
    return <CircleAlert className="text-warning-700 size-4" aria-hidden />;
  return <CircleDashed className="text-muted size-4" aria-hidden />;
}

export default async function SettingsPage({ searchParams }: PageProps<"/workspace/settings">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const tab: Tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "company";
  const db = await getDb();
  const canManage = ctx.can("settings.manage");

  let body: React.ReactNode = null;
  switch (tab) {
    case "company": {
      const c = await getPlatformSetting(db, "company");
      const legal = await getPlatformSetting(db, "legal");
      body = (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Company details"
              description="Used on invoices, proposals, emails and the website's structured data. Verify them before launch."
            />
            <CardBody>
              {!c.detailsVerified && (
                <div className="mb-4">
                  <Callout tone="warning" title="Not verified yet">
                    These were copied from the old website. Confirm each one, then tick
                    &quot;verified&quot;.
                  </Callout>
                </div>
              )}
              <ActionForm
                action={saveCompanyAction}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <TextField name="legalName" label="Legal name" defaultValue={c.legalName} />
                <TextField name="tradingName" label="Trading name" defaultValue={c.tradingName} />
                <TextField name="email" label="Email" defaultValue={c.email} />
                <TextField name="phone" label="Phone" defaultValue={c.phone} />
                <TextField
                  name="streetAddress"
                  label="Street address"
                  defaultValue={c.streetAddress ?? ""}
                />
                <TextField name="locality" label="Town/city" defaultValue={c.locality} />
                <TextField
                  name="postalCode"
                  label="Postal code"
                  defaultValue={c.postalCode ?? ""}
                />
                <TextField name="region" label="Province" defaultValue={c.region} />
                <TextField name="country" label="Country" defaultValue={c.country} />
                <TextField
                  name="registrationNumber"
                  label="Company registration number"
                  defaultValue={c.registrationNumber ?? ""}
                />
                <TextField name="vatNumber" label="VAT number" defaultValue={c.vatNumber ?? ""} />
                <TextField name="linkedinUrl" label="LinkedIn" defaultValue={c.linkedinUrl ?? ""} />
                <TextField
                  name="instagramUrl"
                  label="Instagram"
                  defaultValue={c.instagramUrl ?? ""}
                />
                <TextField name="facebookUrl" label="Facebook" defaultValue={c.facebookUrl ?? ""} />
                <div className="md:col-span-2">
                  <CheckboxField
                    name="detailsVerified"
                    label="I've checked these details and they're correct"
                    defaultChecked={c.detailsVerified}
                  />
                </div>
                {canManage && <SubmitButton>Save</SubmitButton>}
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Legal pages"
              description="Each page shows a draft notice until you confirm its current version was reviewed. Only tick a page after you (or your attorney) have checked this exact version."
            />
            <CardBody>
              <ActionForm action={saveLegalReviewAction} className="space-y-3">
                {LEGAL_DOCS.map((d) => (
                  <CheckboxField
                    key={d.slug}
                    name={d.slug}
                    label={`${d.title} (updated ${d.updated})`}
                    hint={
                      <a
                        href={`/legal/${d.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Read it
                      </a>
                    }
                    defaultChecked={legal.reviewed[d.slug]}
                  />
                ))}
                {ctx.role === "founder" && <SubmitButton size="sm">Save</SubmitButton>}
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      );
      break;
    }
    case "billing": {
      const b = await getPlatformSetting(db, "billing");
      const bank = await getBankDetails(db);
      const founder = ctx.role === "founder";
      body = (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Billing"
              description="Applies to new invoices. Existing invoices keep the tax they were issued with."
            />
            <CardBody>
              <ActionForm
                action={saveBillingAction}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <SelectField
                  name="defaultCurrency"
                  label="Default currency"
                  defaultValue={b.defaultCurrency}
                  options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))}
                />
                <TextField
                  name="paymentTermsDays"
                  type="number"
                  label="Payment terms (days)"
                  defaultValue={String(b.paymentTermsDays)}
                />
                <div className="md:col-span-2">
                  <CheckboxField
                    name="vatRegistered"
                    label="Mea Creo is VAT registered"
                    defaultChecked={b.vatRegistered}
                    hint="Only tick this once SARS registration is confirmed. Add the VAT number under Company."
                  />
                </div>
                <TextField
                  name="taxRatePercent"
                  type="number"
                  label="VAT rate (%)"
                  defaultValue={String(b.taxRatePercent)}
                />
                <TextField
                  name="pauseAfterOverdueDays"
                  type="number"
                  label="Pause services after (days overdue)"
                  defaultValue={String(b.pauseAfterOverdueDays)}
                />
                <TextField
                  name="reminderDaysAfterDue"
                  label="Reminders (days after due)"
                  defaultValue={b.reminderDaysAfterDue.join(", ")}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    name="invoicePrefix"
                    label="Invoice prefix"
                    defaultValue={b.invoicePrefix}
                  />
                  <TextField
                    name="proposalPrefix"
                    label="Proposal prefix"
                    defaultValue={b.proposalPrefix}
                  />
                </div>
                <TextField
                  name="standardTermMonths"
                  type="number"
                  label="Standard minimum term (months)"
                  defaultValue={String(b.standardTermMonths)}
                />
                <TextField
                  name="annualDiscountPercent"
                  type="number"
                  label="12-month commitment discount (%)"
                  hint="Applied to monthly fees on 12-month proposals and shown on the pricing page. 0 hides the option."
                  defaultValue={String(b.annualDiscountPercent)}
                />
                <div className="md:col-span-2">
                  <CheckboxField
                    name="showPricesPublicly"
                    label="Show package prices on the public website"
                    hint="Recommended: clear prices qualify enquiries before the first call."
                    defaultChecked={b.showPricesPublicly}
                  />
                </div>

                {ctx.can("billing.manage") && <SubmitButton>Save</SubmitButton>}
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Banking details"
              description="Printed on unpaid invoices and shown to signed-in clients on their billing page. Stored encrypted; never on the public website, in AI prompts or in the code."
            />
            <CardBody className="space-y-4">
              {bank ? (
                <DescriptionList
                  items={[
                    ["Bank", bank.bank],
                    ["Account holder", bank.accountHolder],
                    ["Account type", bank.accountType || null],
                    ["Branch code", bank.branchCode],
                    ["Account number", maskAccountNumber(bank.accountNumber)],
                  ]}
                />
              ) : (
                <Callout tone="warning" title="Not set">
                  Invoices will say EFT details are available on request.
                </Callout>
              )}
              {founder ? (
                <details>
                  <summary className="text-brand-700 cursor-pointer text-sm">
                    {bank ? "Change banking details" : "Add banking details"}
                  </summary>
                  <ActionForm
                    action={saveBankDetailsAction}
                    className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2"
                  >
                    <TextField name="bank" label="Bank" defaultValue={bank?.bank ?? ""} />
                    <TextField
                      name="accountHolder"
                      label="Account holder"
                      defaultValue={bank?.accountHolder ?? ""}
                    />
                    <TextField
                      name="accountType"
                      label="Account type"
                      defaultValue={bank?.accountType ?? ""}
                    />
                    <TextField
                      name="branchCode"
                      label="Branch code"
                      defaultValue={bank?.branchCode ?? ""}
                      inputMode="numeric"
                    />
                    <TextField
                      name="accountNumber"
                      label="Account number"
                      inputMode="numeric"
                      autoComplete="off"
                      hint="Enter the full number each time you save. It is never displayed in full here."
                    />
                    <div className="flex items-end">
                      <SubmitButton>Save banking details</SubmitButton>
                    </div>
                  </ActionForm>
                </details>
              ) : (
                <p className="text-muted text-sm">Only a founder can change banking details.</p>
              )}
            </CardBody>
          </Card>
        </div>
      );
      break;
    }
    case "booking": {
      const b = await getPlatformSetting(db, "booking");
      body = (
        <Card>
          <CardHeader
            title="Availability"
            description={`When people can book calls on the website and in the portal (${b.timezone}).`}
          />
          <CardBody>
            <ActionForm action={saveBookingAction} className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Discovery call days (website bookings)
                </legend>
                <div className="flex flex-wrap gap-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="discoveryDays"
                        value={i}
                        defaultChecked={b.discoveryDays.includes(i)}
                        className="accent-brand-700 size-4"
                      />{" "}
                      {d}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Working days (client meetings)</legend>
                <div className="flex flex-wrap gap-3">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="workingDays"
                        value={i}
                        defaultChecked={b.workingDays.includes(i)}
                        className="accent-brand-700 size-4"
                      />{" "}
                      {d}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TextField
                  name="startHour"
                  type="number"
                  label="Day starts (hour)"
                  defaultValue={String(b.startHour)}
                />
                <TextField
                  name="endHour"
                  type="number"
                  label="Day ends (hour)"
                  defaultValue={String(b.endHour)}
                />
                <TextField
                  name="bufferMinutes"
                  type="number"
                  label="Buffer between calls (min)"
                  defaultValue={String(b.bufferMinutes)}
                />
                <TextField
                  name="minNoticeHours"
                  type="number"
                  label="Minimum notice (hours)"
                  defaultValue={String(b.minNoticeHours)}
                />
                <TextField
                  name="minNoticeBusinessDays"
                  type="number"
                  label="Minimum notice (business days)"
                  defaultValue={String(b.minNoticeBusinessDays)}
                />
                <TextField
                  name="maxBookingsPerDay"
                  type="number"
                  label="Maximum bookings per day (0 = no limit)"
                  defaultValue={String(b.maxBookingsPerDay)}
                />
                <TextField
                  name="horizonDays"
                  type="number"
                  label="Bookable days ahead"
                  defaultValue={String(b.horizonDays)}
                />
                <TextField
                  name="duration.discovery"
                  type="number"
                  label="Visibility review call (min)"
                  defaultValue={String(b.durations.discovery)}
                />
                <TextField
                  name="duration.client"
                  type="number"
                  label="Client meeting (min)"
                  defaultValue={String(b.durations.client)}
                />
              </div>
              {canManage && <SubmitButton>Save</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      );
      break;
    }
    case "approvals": {
      const a = await getPlatformSetting(db, "automation");
      body = (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Approval rules"
              description="Who must approve each kind of action. Payments, refunds, contracts, cancellations and budget changes always need a person, whatever is set here."
            />
            <CardBody>
              <ActionForm action={saveAutomationAction} className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted text-left text-xs">
                      <tr className="border-border border-b">
                        <th className="py-2 font-medium">Action</th>
                        <th className="py-2 font-medium">Approval level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTION_ROWS.map(([key, label]) => {
                        const locked =
                          HARD_LOCKED_TYPES.includes(key as never) ||
                          HARD_LOCKED_ACTIONS.some((h) => key.startsWith(h));
                        return (
                          <tr key={key} className="border-border border-b last:border-0">
                            <td className="py-2 pr-4">
                              {label}
                              {locked && <Badge tone="warning">Always needs a person</Badge>}
                            </td>
                            <td className="py-2">
                              <select
                                name={`level.${key}`}
                                aria-label={`${label} approval level`}
                                defaultValue={a.approvalOverrides[key] ?? "default"}
                                className="border-border-strong bg-surface h-9 rounded-md border px-2 text-sm"
                              >
                                <option value="default">Default for the service</option>
                                {APPROVAL_LEVELS.filter((l) => !(locked && l === "automatic")).map(
                                  (l) => (
                                    <option key={l} value={l}>
                                      {LEVEL_LABELS[l]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    name="monthlyCycleDay"
                    type="number"
                    label="Monthly review day (1–28)"
                    defaultValue={String(a.monthlyCycleDay)}
                  />
                  <CheckboxField
                    name="autoGenerateBriefings"
                    label="Prepare call briefings automatically"
                    defaultChecked={a.autoGenerateBriefings}
                  />
                </div>
                {canManage && <SubmitButton>Save rules</SubmitButton>}
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Workflows"
              description="What happens automatically when something happens. Each step still follows the approval rules above."
            />
            <ul className="divide-border divide-y">
              {WORKFLOW_RULES.map((w) => (
                <li key={w.id} className="px-5 py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {w.name} <Badge tone="neutral">When {w.when}</Badge>{" "}
                    <Badge tone="brand">{humanize(w.defaultMaturity)}</Badge>
                  </p>
                  <p className="text-muted text-xs">{w.description}</p>
                  <p className="text-ink-soft mt-1 text-xs">Then: {w.then.join(" → ")}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      );
      break;
    }
    case "ai": {
      const a = await getPlatformSetting(db, "ai");
      body = (
        <Card>
          <CardHeader
            title="AI limits"
            description="Hard limits on AI spend. When a budget is reached, agents switch to rules mode instead of spending more."
          />
          <CardBody>
            <ActionForm action={saveAiAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                name="monthlyBudgetUsd"
                type="number"
                label="Monthly AI budget (USD)"
                defaultValue={String(a.monthlyBudgetUsd)}
              />
              <TextField
                name="perClientMonthlyBudgetUsd"
                type="number"
                label="Per-client monthly budget (USD)"
                defaultValue={String(a.perClientMonthlyBudgetUsd)}
              />
              <TextField
                name="maxStepsPerRun"
                type="number"
                label="Maximum agent steps per run"
                defaultValue={String(a.maxStepsPerRun)}
              />
              <TextField
                name="approvalThresholdUsd"
                type="number"
                label="Ask before a run estimated above (USD)"
                defaultValue={String(a.approvalThresholdUsd)}
              />
              {canManage && <SubmitButton>Save</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      );
      break;
    }
    case "emergency": {
      const e = await getPlatformSetting(db, "emergency");
      body = (
        <Card>
          <CardHeader
            title="Emergency controls"
            description="Stop things immediately. Nothing is deleted; switching off resumes normal operation. Individual agents can be paused under Runs & agents."
          />
          <CardBody>
            <ActionForm action={saveEmergencyAction} className="space-y-3">
              <CheckboxField
                name="pauseAllAutomation"
                label="Pause all automation (runs, agents and workflows)"
                defaultChecked={e.pauseAllAutomation}
              />
              <CheckboxField
                name="pauseOutboundEmail"
                label="Pause notification and marketing email (receipts, invoices, invitations and password resets still send)"
                defaultChecked={e.pauseOutboundEmail}
              />
              <CheckboxField
                name="pausePayments"
                label="Pause online payments"
                defaultChecked={e.pausePayments}
              />
              {ctx.can("emergency.controls") && <SubmitButton variant="danger">Apply</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      );
      break;
    }
    case "team": {
      const team = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          disabledAt: users.disabledAt,
          lastLoginAt: users.lastLoginAt,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.organisationId, ctx.platformOrganisationId));
      const manage = ctx.can("users.manage");
      body = (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader
              title="Team"
              description="Only add real people. Specialists and creatives see only the clients assigned to them."
            />
            <ul className="divide-border divide-y">
              {team.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {m.name} {m.disabledAt && <Badge tone="neutral">Disabled</Badge>}
                    </span>
                    <span className="text-muted block text-xs">
                      {m.email} ·{" "}
                      {m.lastLoginAt
                        ? `last signed in ${fmtDateTime(m.lastLoginAt)}`
                        : "never signed in"}
                    </span>
                  </span>
                  {manage && m.id !== ctx.user.id ? (
                    <form
                      action={updateStaffAction.bind(null, m.id)}
                      className="flex items-center gap-2"
                    >
                      <select
                        name="role"
                        defaultValue={m.role}
                        aria-label={`Role for ${m.name}`}
                        className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
                      >
                        {STAFF_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <button
                        name="op"
                        value="role"
                        className="border-border hover:bg-surface-2 rounded-md border px-2 py-1 text-xs"
                      >
                        Save
                      </button>
                      <button
                        name="op"
                        value={m.disabledAt ? "enable" : "disable"}
                        className="text-danger-700 hover:bg-danger-100 rounded-md px-2 py-1 text-xs"
                      >
                        {m.disabledAt ? "Enable" : "Disable"}
                      </button>
                    </form>
                  ) : (
                    <Badge tone="neutral">{ROLE_LABELS[m.role as StaffRole]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {manage && (
            <Card className="h-fit">
              <CardHeader title="Invite a team member" />
              <CardBody>
                <ActionForm action={inviteStaffAction} className="space-y-3" resetOnSuccess>
                  <TextField name="name" label="Name" required />
                  <TextField name="email" type="email" label="Email" required />
                  <SelectField
                    name="role"
                    label="Role"
                    defaultValue="specialist"
                    options={STAFF_ROLES.map((r) => ({
                      value: r,
                      label: `${ROLE_LABELS[r]}: ${ROLE_DESCRIPTIONS[r]}`,
                    }))}
                  />
                  <SubmitButton>Send invitation</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      );
      break;
    }
    case "integrations": {
      const health = await integrationHealth();
      body = (
        <Card>
          <CardHeader
            title="Integration health"
            description="Credentials live in server environment variables, never in the browser. A test (mock) adapter is clearly marked and refused in production."
          />
          <ul className="divide-border divide-y">
            {health.map((h) => {
              const info = INTEGRATION_LABELS[h.kind] ?? { name: humanize(h.kind), env: "" };
              const real = h.status === "CONNECTED" && !h.mock;
              return (
                <li
                  key={h.kind}
                  className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <span className="flex items-start gap-3">
                    <StatusIcon h={h} />
                    <span>
                      <span className="block text-sm font-medium">{info.name}</span>
                      <span className="text-muted block text-xs">{h.message}</span>
                      {!real && info.env && (
                        <span className="text-subtle mt-1 block font-mono text-[0.7rem]">
                          {info.env}
                        </span>
                      )}
                    </span>
                  </span>
                  <Badge
                    tone={
                      real
                        ? "success"
                        : h.mock
                          ? "warning"
                          : h.status === "ERROR"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {real ? "Connected" : h.mock ? "Test mode" : "REQUIRES CONFIGURATION"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      );
      break;
    }
    case "api": {
      const keys = await db
        .select()
        .from(apiKeys)
        .where(isNull(apiKeys.revokedAt))
        .orderBy(desc(apiKeys.createdAt));
      body = (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader
              title="API keys"
              description="For Founder OS, Sales Scout and other tools you connect. Keys are shown once and stored hashed."
            />
            <ul className="divide-border divide-y">
              {keys.length === 0 && (
                <li className="text-muted px-5 py-4 text-sm">No active keys.</li>
              )}
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="block text-sm font-medium">{k.name}</span>
                    <span className="text-muted block font-mono text-xs">
                      mc_{k.prefix}_… · {k.scopes.join(", ")} ·{" "}
                      {k.lastUsedAt ? `used ${fmtDateTime(k.lastUsedAt)}` : "never used"}
                    </span>
                  </span>
                  {ctx.can("integrations.manage") && (
                    <form action={revokeApiKeyAction.bind(null, k.id)}>
                      <SubmitButton size="sm" variant="ghost">
                        Revoke
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {ctx.can("integrations.manage") && (
            <Card className="h-fit">
              <CardHeader title="New key" />
              <CardBody>
                <ActionForm action={createApiKeyAction} className="space-y-3">
                  <TextField name="name" label="Used by" placeholder="Founder OS" required />
                  <fieldset className="space-y-1.5">
                    <legend className="mb-1 text-sm font-medium">Permissions</legend>
                    {API_SCOPES.map((s) => (
                      <label key={s} className="flex items-center gap-2 font-mono text-xs">
                        <input
                          type="checkbox"
                          name="scopes"
                          value={s}
                          className="accent-brand-700 size-4"
                        />{" "}
                        {s}
                      </label>
                    ))}
                  </fieldset>
                  <SubmitButton>Create key</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      );
      break;
    }
    case "email": {
      const rows = await db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(100);
      body = (
        <Card>
          <CardHeader
            title="Email log"
            description="Every email the system sent or tried to send (last 100). With the test email adapter, nothing leaves the system: read them here."
          />
          <ul className="divide-border divide-y">
            {rows.length === 0 && <li className="text-muted px-5 py-4 text-sm">No emails yet.</li>}
            {rows.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{e.subject}</span>
                    <span className="text-muted text-xs">
                      to {e.to} · {e.template} · {e.provider} · {fmtDateTime(e.createdAt)}
                    </span>
                    <Badge
                      tone={
                        e.status === "sent"
                          ? "success"
                          : e.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {e.status}
                    </Badge>
                  </summary>
                  <pre className="bg-surface-2 mt-2 rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {e.text}
                  </pre>
                  {e.error && <p className="text-danger-700 mt-1 text-xs">{e.error}</p>}
                </details>
              </li>
            ))}
          </ul>
        </Card>
      );
      break;
    }
    case "activity": {
      const rows = await db
        .select()
        .from(activityLog)
        .orderBy(desc(activityLog.createdAt))
        .limit(200);
      body = (
        <Card>
          <CardHeader
            title="Activity log"
            description="Who did what, when (last 200 entries). Kept for accountability; entries can't be edited."
          />
          <ul className="divide-border divide-y text-sm">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-0.5 px-5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span>
                  {a.summary}
                  {a.reason && <span className="text-muted"> · reason: {a.reason}</span>}
                </span>
                <span className="text-muted shrink-0 text-xs">
                  {a.actorLabel ?? a.actorType} · {fmtDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      );
      break;
    }
    case "business": {
      const t = await getPlatformSetting(db, "targets");
      const major = (v: number | null) => (v == null ? "" : String(v / 100));
      body = (
        <Card>
          <CardHeader
            title="Business targets"
            description="Your own numbers, used on the Business page. Leave blank if you'd rather not set one."
          />
          <CardBody>
            <ActionForm
              action={saveTargetsAction}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <TextField
                name="targetMrr"
                label="Target monthly recurring revenue (R)"
                defaultValue={major(t.targetMrrMinor)}
                inputMode="decimal"
              />
              <TextField
                name="targetMonthlyRevenue"
                label="Target monthly revenue (R)"
                defaultValue={major(t.targetMonthlyRevenueMinor)}
                inputMode="decimal"
              />
              <TextField
                name="monthlyOperatingCosts"
                label="Monthly operating costs (R)"
                defaultValue={major(t.monthlyOperatingCostsMinor)}
                inputMode="decimal"
              />
              <TextField
                name="desiredMarginPercent"
                label="Desired margin (%)"
                defaultValue={t.desiredMarginPercent == null ? "" : String(t.desiredMarginPercent)}
              />
              <TextField
                name="minimumMonthlyValue"
                label="Minimum monthly client value (R, internal floor)"
                defaultValue={major(t.minimumMonthlyValueMinor)}
                inputMode="decimal"
                hint="Used to flag prospects below the floor. Never shown publicly."
              />
              <TextField
                name="targetAverageClientValue"
                label="Target average client value (R/month)"
                defaultValue={major(t.targetAverageClientValueMinor)}
                inputMode="decimal"
              />
              <TextField
                name="targetNewClientsPerMonth"
                type="number"
                label="Target new clients per month"
                defaultValue={
                  t.targetNewClientsPerMonth == null ? "" : String(t.targetNewClientsPerMonth)
                }
              />
              <TextField
                name="clientCapacity"
                type="number"
                label="Personal client capacity"
                defaultValue={t.clientCapacity == null ? "" : String(t.clientCapacity)}
              />
              {canManage && <SubmitButton>Save</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      );
      break;
    }
    case "prospecting": {
      const [q, o] = await Promise.all([
        getPlatformSetting(db, "qualification"),
        getPlatformSetting(db, "outreach"),
      ]);
      const list = (v: string[]) => v.join("\n");
      body = (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Qualification rules"
              description="Who counts as an ideal client. Every prospect score explains itself against these rules. One per line; matching is case-insensitive."
            />
            <CardBody>
              <ActionForm
                action={saveQualificationAction}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <TextArea
                  name="targetIndustries"
                  label="Target industries"
                  defaultValue={list(q.targetIndustries)}
                  rows={8}
                  disabled={!canManage}
                />
                <TextArea
                  name="decisionMakerRoles"
                  label="Decision-maker roles"
                  defaultValue={list(q.decisionMakerRoles)}
                  rows={8}
                  disabled={!canManage}
                />
                <TextArea
                  name="idealEmployeeRanges"
                  label="Ideal company sizes (employees)"
                  defaultValue={list(q.idealEmployeeRanges)}
                  rows={4}
                  hint="Ranges like 11-50 or 51-200."
                  disabled={!canManage}
                />
                <TextArea
                  name="poorFitSignals"
                  label="Poor-fit signals"
                  defaultValue={list(q.poorFitSignals)}
                  rows={4}
                  hint="Phrases in an enquiry that suggest a poor fit, such as 'lowest price'."
                  disabled={!canManage}
                />
                {canManage && (
                  <div className="md:col-span-2">
                    <SubmitButton>Save rules</SubmitButton>
                  </div>
                )}
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Outreach limits"
              description="Outreach stays personal and POPIA-compliant: every message needs approval, opt-outs are suppressed on every channel, and the daily cap applies across all channels."
            />
            <CardBody>
              <ActionForm
                action={saveOutreachAction}
                className="grid grid-cols-1 gap-4 md:grid-cols-3"
              >
                <TextField
                  name="maxPerDay"
                  type="number"
                  min={1}
                  max={50}
                  label="Maximum messages per day"
                  defaultValue={String(o.maxPerDay)}
                  disabled={!canManage}
                />
                <TextField
                  name="senderName"
                  label="Sender name"
                  defaultValue={o.senderName}
                  disabled={!canManage}
                />
                <TextField
                  name="senderTitle"
                  label="Sender title"
                  defaultValue={o.senderTitle}
                  disabled={!canManage}
                />
                {canManage && (
                  <div className="md:col-span-3">
                    <SubmitButton>Save limits</SubmitButton>
                  </div>
                )}
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      );
      break;
    }
    case "quality": {
      const qa = await getPlatformSetting(db, "qa");
      body = (
        <Card>
          <CardHeader
            title="QA checklist"
            description="Every deliverable is checked against these before it can go to the client. One check per line. Add [content, website] at the end to limit a check to those types."
          />
          <CardBody>
            <ActionForm action={saveQaChecklistAction} className="space-y-4">
              <TextArea
                name="checks"
                label="Checks"
                rows={14}
                defaultValue={qa.checks
                  .map((c) => (c.kinds.length ? `${c.label} [${c.kinds.join(", ")}]` : c.label))
                  .join("\n")}
                hint="Types: content, website, seo, geo, aeo, social, ads, design, report, document, other."
                disabled={!canManage}
              />
              {canManage && <SubmitButton>Save checklist</SubmitButton>}
            </ActionForm>
          </CardBody>
        </Card>
      );
      break;
    }
    case "data": {
      body = (
        <Card>
          <CardHeader
            title="Data"
            description="Export a client's complete record (Client Brain, work, reports, invoices, messages, files list) as JSON, for a client request under POPIA or for your own backup."
          />
          <CardBody className="space-y-3 text-sm">
            <p>
              Open a client, then Settings → Export data. Each export is recorded in the activity
              log.
            </p>
            <p className="text-muted">
              Database backups are handled by your database host (see the Deployment guide). Clients
              are never hard-deleted from the interface: archiving keeps their history.
            </p>
            <LinkButton href="/workspace/clients" variant="secondary" size="sm">
              <Download className="size-4" aria-hidden /> Go to clients
            </LinkButton>
          </CardBody>
        </Card>
      );
      break;
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs
        baseHref="/workspace/settings"
        active={tab}
        tabs={TABS.map(([key, label]) => ({ key, label }))}
      />
      {body}
    </>
  );
}
