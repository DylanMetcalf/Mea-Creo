import { ArrowRight, Inbox, Loader2, Search } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IndexRing } from "@/components/audits/index-ring";
import { Logo } from "@/components/brand/logo";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { BarList, Sparkline } from "@/components/ui/charts";
import {
  ErrorState,
  Kbd,
  Metric,
  Skeleton,
  Spinner,
  Table,
  Timeline,
  Tooltip,
} from "@/components/ui/feedback";
import {
  CheckboxField,
  FileDropField,
  RadioField,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/form";
import {
  Avatar,
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  Stat,
  type Tone,
} from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { requireStaff } from "@/modules/auth/context";
import { OverlayDemos } from "./interactive";

export const metadata: Metadata = { title: "Design system" };

const COLOURS: [string, string, string][] = [
  ["Ink", "--ink", "Text, primary"],
  ["Muted", "--muted", "Secondary text"],
  ["Paper", "--paper", "App background (mist)"],
  ["Surface", "--surface", "Cards, inputs"],
  ["Border", "--border", "Dividers"],
  ["Brand 700", "--brand-700", "Primary actions"],
  ["Brand 500", "--brand-500", "Accents, focus"],
  ["Brand 100", "--brand-100", "Tints"],
  ["Signal", "--signal", "Highlights on dark"],
  ["Dusk 700", "--dusk-700", "Secondary accent"],
  ["Dusk 300", "--dusk-300", "Light accent"],
  ["Ember", "--ember-500", "Warm light, attention"],
  ["Night", "--night", "Dark sections, sidebar"],
  ["Night 3", "--night-3", "Raised dark surfaces"],
  ["Success", "--success-700", "Good state"],
  ["Warning", "--warning-700", "Needs attention"],
  ["Danger", "--danger-700", "Errors, destructive"],
  ["Info", "--info-700", "Information"],
];

const GRADIENTS: [string, string, string][] = [
  ["Signal", "bg-signal", "Primary buttons and progress"],
  ["Horizon", "bg-horizon", "Hero panels, CTAs, dark moments"],
  ["Aurora", "bg-aurora bg-paper", "Background light on light pages"],
];

const VARIANTS: ButtonVariant[] = [
  "primary",
  "cta",
  "secondary",
  "ghost",
  "danger",
  "inverse",
  "glass",
];

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="font-display text-ink mb-4 text-[1.35rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="label-mono text-subtle mb-2">{children}</p>;
}

/**
 * The visual source of truth: every token and component in each of its states.
 * Change a token in globals.css and this page (and the whole product) follows.
 */
export default async function DesignSystemPage() {
  await requireStaff();
  return (
    <div className="space-y-14">
      <PageHeader
        eyebrow="Internal"
        title="Mea Creo design system"
        description="Tokens and components in every state. Everything in the website, workspace, portal, reports and emails is built from these."
      />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {[
          "brand",
          "colour",
          "type",
          "buttons",
          "inputs",
          "feedback",
          "data",
          "navigation",
          "overlays",
        ].map((s) => (
          <a
            key={s}
            href={`#${s}`}
            className="border-border bg-surface hover:border-brand-300 rounded-full border px-3 py-1 text-sm capitalize transition-colors"
          >
            {s}
          </a>
        ))}
      </nav>

      <Block id="brand" title="Brand">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="flex items-center justify-center p-8">
            <Logo size="lg" />
          </Card>
          <div className="bg-night rounded-card flex items-center justify-center p-8">
            <Logo size="lg" inverse />
          </div>
          <div className="bg-horizon rounded-card flex items-center justify-center p-8">
            <Logo size="lg" inverse />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {GRADIENTS.map(([name, cls, use]) => (
            <div key={name}>
              <div className={`${cls} rounded-card h-24`} />
              <p className="mt-2 text-sm font-medium">{name}</p>
              <p className="text-muted text-xs">{use}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block id="colour" title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLOURS.map(([name, token, use]) => (
            <div key={token}>
              <div
                className="border-border/70 h-16 rounded-xl border"
                style={{ background: `var(${token})` }}
              />
              <p className="mt-2 text-sm font-medium">{name}</p>
              <p className="label-mono text-subtle">{token}</p>
              <p className="text-muted text-xs">{use}</p>
            </div>
          ))}
        </div>
      </Block>

      <Block id="type" title="Typography">
        <Card>
          <CardBody className="space-y-5">
            <div>
              <Label>Display · Manrope 700 · tight</Label>
              <p className="font-display text-[3rem] leading-none">Easier to choose.</p>
            </div>
            <div>
              <Label>Heading · Manrope 700</Label>
              <p className="font-display text-[1.75rem]">Your biggest opportunities</p>
            </div>
            <div>
              <Label>Body · Geist 400</Label>
              <p className="text-ink-soft max-w-2xl leading-relaxed">
                Every finding explains what&apos;s happening, why it matters and what to do. Body
                text stays near 65 characters wide for comfortable reading.
              </p>
            </div>
            <div>
              <Label>Label · Geist Mono · uppercase</Label>
              <p className="label-mono text-brand-600">Mea Creo Visibility Index</p>
            </div>
            <div>
              <Label>Gradient text (sparingly)</Label>
              <p className="font-display text-gradient text-[2rem]">Easier to choose.</p>
            </div>
          </CardBody>
        </Card>
      </Block>

      <Block id="buttons" title="Buttons">
        <Card>
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left">
                  {["Variant", "Default", "Focus", "Disabled", "Loading"].map((h) => (
                    <th key={h} className="label-mono text-subtle pb-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VARIANTS.map((v) => {
                  const dark = v === "inverse" || v === "glass";
                  return (
                    <tr key={v} className={dark ? "bg-night" : undefined}>
                      <td
                        className={`py-3 pl-2 font-medium capitalize ${dark ? "text-white" : ""}`}
                      >
                        {v}
                      </td>
                      <td className="py-3">
                        <Button variant={v}>
                          Book a call <ArrowRight className="size-4" aria-hidden />
                        </Button>
                      </td>
                      <td className="py-3">
                        <Button
                          variant={v}
                          className="outline-brand-500 outline-2 outline-offset-2"
                        >
                          Focused
                        </Button>
                      </td>
                      <td className="py-3">
                        <Button variant={v} disabled>
                          Disabled
                        </Button>
                      </td>
                      <td className="py-3">
                        <Button variant={v} aria-disabled aria-busy>
                          <Loader2 className="size-4 animate-spin" aria-hidden /> Saving…
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-muted mt-4 text-xs">
              Hover lifts the button by one pixel and adds light; pressing pushes it down. Sizes:
              sm, md, lg and xl (conversion moments only).
            </p>
          </CardBody>
        </Card>
      </Block>

      <Block id="inputs" title="Inputs">
        <Card>
          <CardBody className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextField name="ds-name" label="Company name" hint="As it appears on invoices." />
            <div className="space-y-1.5">
              <label htmlFor="ds-err" className="text-ink block text-sm font-medium">
                Email (error state)
              </label>
              <input
                id="ds-err"
                defaultValue="dylan@"
                aria-invalid="true"
                aria-describedby="ds-err-msg"
                className="border-danger-700 bg-surface focus:ring-danger-100 block w-full rounded-[10px] border px-3 py-2 text-sm focus:ring-4 focus:outline-none"
              />
              <p id="ds-err-msg" className="text-danger-700 text-xs">
                Enter a full email address, like dylan@meacreo.co.za.
              </p>
            </div>
            <SelectField
              name="ds-select"
              label="Package"
              options={[
                { value: "visibility", label: "Visibility" },
                { value: "growth", label: "Growth" },
                { value: "scale", label: "Scale" },
              ]}
            />
            <div className="space-y-1.5">
              <label htmlFor="ds-dis" className="text-ink block text-sm font-medium">
                Disabled
              </label>
              <input
                id="ds-dis"
                disabled
                defaultValue="Locked by the approval engine"
                className="border-border-strong bg-surface-2 text-muted block w-full cursor-not-allowed rounded-[10px] border px-3 py-2 text-sm"
              />
            </div>
            <TextArea name="ds-notes" label="Notes" rows={3} />
            <div className="space-y-4">
              <CheckboxField
                name="ds-check"
                label="Email me when a report is ready"
                defaultChecked
              />
              <RadioField
                name="ds-radio"
                label="Channel"
                defaultValue="email"
                options={[
                  { value: "email", label: "Email", hint: "Sent after approval" },
                  { value: "linkedin", label: "LinkedIn", hint: "You send it yourself" },
                ]}
              />
            </div>
            <div className="md:col-span-2">
              <FileDropField
                name="ds-file"
                label="Upload brand assets"
                hint="PNG, JPG, PDF up to 20 MB"
                multiple
              />
            </div>
          </CardBody>
        </Card>
      </Block>

      <Block id="feedback" title="Status and feedback">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["neutral", "brand", "success", "warning", "danger", "info", "clay"] as Tone[]).map(
              (t) => (
                <Badge key={t} tone={t} dot>
                  {t}
                </Badge>
              ),
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Callout tone="success" title="Report published">
              Thandi was notified and can see it in her portal.
            </Callout>
            <Callout tone="warning" title="Bank details not entered">
              Invoices show &ldquo;EFT details on request&rdquo; until you add them.
            </Callout>
            <Callout tone="danger" title="Message not sent">
              They opted out. Every channel is suppressed.
            </Callout>
            <Callout tone="info" title="First contact: ask permission only">
              POPIA allows one message asking whether they&apos;d like to hear from you.
            </Callout>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardBody className="space-y-3">
                <Label>Loading</Label>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16" />
                <Spinner label="Loading report" />
              </CardBody>
            </Card>
            <EmptyState
              icon={<Inbox className="size-6" />}
              title="Nothing waiting"
              description="Draft outreach from a lead's page."
            />
            <ErrorState
              title="We couldn't reach that website"
              description="Check the address and try again."
              action={<Button variant="secondary">Try again</Button>}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Progress value={68} label="Onboarding" />
            <div className="flex items-center gap-4">
              <Avatar name="Dylan Metcalf" />
              <Avatar name="Thandi Nkosi" size="sm" />
              <Tooltip label="Opens the command palette">
                <button
                  type="button"
                  className="text-muted inline-flex items-center gap-1.5 text-sm"
                >
                  <Search className="size-4" aria-hidden /> Search <Kbd>⌘K</Kbd>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Block>

      <Block id="data" title="Data">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Monthly recurring revenue" value="R51k" hint="2 paying clients" />
          <Metric label="Enquiries (example)" value="14" change={27} hint="vs last month" />
          <Metric label="Opt-out rate (example)" value="3%" change={-2} />
          <Card className="flex items-center gap-4 px-4 py-3">
            <IndexRing value={72} size={64} stroke={6} />
            <div>
              <p className="text-muted text-xs">Visibility Index</p>
              <Sparkline values={[48, 52, 51, 58, 63, 72]} />
            </div>
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Bar list" description="Single series, magnitude" />
            <CardBody>
              <BarList
                ariaLabel="Example revenue by service"
                data={[
                  { label: "SEO", value: 17000, display: "R17,000" },
                  { label: "Lead generation", value: 9500, display: "R9,500" },
                  { label: "Content", value: 6500, display: "R6,500" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Timeline" description="Activity feed and audit history" />
            <CardBody>
              <Timeline
                items={[
                  {
                    id: "1",
                    title: "Report published",
                    meta: "Today, 09:12 · Dylan",
                    tone: "success",
                  },
                  {
                    id: "2",
                    title: "Approval requested",
                    meta: "Yesterday · Reporting agent",
                    tone: "warning",
                  },
                  {
                    id: "3",
                    title: "Visibility Report run",
                    meta: "1 Oct · System",
                    tone: "brand",
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>
        <Table className="mt-4">
          <thead>
            <tr>
              <th>Client</th>
              <th>Package</th>
              <th>Health</th>
              <th className="text-right">Monthly</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Harbourline Engineering (Demo)", "Growth", "success", "Healthy", "R12,500"],
              ["Veldt Precision (Demo)", "Visibility", "danger", "At risk", "R8,500"],
            ].map(([c, p, tone, h, m]) => (
              <tr key={c}>
                <td className="font-medium">{c}</td>
                <td>{p}</td>
                <td>
                  <Badge tone={tone as Tone} dot>
                    {h}
                  </Badge>
                </td>
                <td className="text-right tabular-nums">{m}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Block>

      <Block id="navigation" title="Navigation">
        <Tabs
          baseHref="/workspace/design-system"
          active="overview"
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "services", label: "Services", count: 5 },
            { key: "billing", label: "Billing" },
          ]}
        />
        <p className="text-muted text-sm">
          Also: the workspace sidebar, breadcrumb, ⌘K command palette, the website header with its
          full-screen mobile menu, and the portal&apos;s bottom tab bar.
        </p>
      </Block>

      <Block id="overlays" title="Overlays">
        <OverlayDemos />
      </Block>
    </div>
  );
}
