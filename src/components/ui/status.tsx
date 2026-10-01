import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { humanize } from "@/lib/format";
import { Badge, type Tone } from "./primitives";

/** Status is always label + tone (and an icon where it matters), never colour alone. */
const MAPS: Record<string, Record<string, Tone>> = {
  health: { healthy: "success", watch: "warning", at_risk: "danger", paused: "neutral" },
  billing: {
    trial: "info",
    pending_payment: "warning",
    active: "success",
    payment_due: "warning",
    overdue: "danger",
    suspended: "danger",
    cancelled: "neutral",
    archived: "neutral",
  },
  lifecycle: { onboarding: "info", active: "success", paused: "neutral", offboarded: "neutral" },
  task: {
    backlog: "neutral",
    ready: "info",
    in_progress: "brand",
    waiting: "warning",
    waiting_client: "warning",
    waiting_approval: "clay",
    blocked: "danger",
    complete: "success",
    cancelled: "neutral",
  },
  priority: { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" },
  approval: {
    pending: "warning",
    approved: "success",
    changes_requested: "clay",
    rejected: "danger",
    cancelled: "neutral",
  },
  level: { automatic: "neutral", client: "clay", internal: "brand", manual: "info" },
  invoice: { draft: "neutral", open: "info", paid: "success", overdue: "danger", void: "neutral" },
  proposal: {
    draft: "neutral",
    sent: "info",
    viewed: "brand",
    accepted: "success",
    declined: "danger",
    expired: "neutral",
  },
  run: {
    queued: "neutral",
    running: "info",
    complete: "success",
    failed: "danger",
    blocked: "warning",
  },
  outcome: {
    completed: "success",
    requires_approval: "clay",
    recommended: "brand",
    blocked: "warning",
    no_action: "neutral",
  },
  audit: { queued: "neutral", running: "info", complete: "success", failed: "danger" },
  service: { pending: "warning", active: "success", paused: "neutral", cancelled: "neutral" },
  lead: {
    new: "info",
    audit_generated: "info",
    qualified: "brand",
    contacted: "brand",
    call_booked: "clay",
    call_completed: "clay",
    proposal_draft: "warning",
    proposal_sent: "warning",
    negotiation: "warning",
    accepted: "success",
    payment_pending: "success",
    onboarding: "success",
    active_client: "success",
    lost: "neutral",
    nurture: "neutral",
    archived: "neutral",
  },
  meeting: {
    requested: "warning",
    scheduled: "info",
    completed: "success",
    cancelled: "neutral",
    no_show: "danger",
  },
  integration: {
    CONNECTED: "success",
    ACTION_REQUIRED: "warning",
    ERROR: "danger",
    NOT_CONNECTED: "neutral",
  },
  content: {
    idea: "neutral",
    brief: "info",
    draft: "info",
    internal_review: "brand",
    client_approval: "clay",
    scheduled: "warning",
    published: "success",
    measuring: "success",
    learning: "neutral",
  },
  dimension: { high: "success", medium: "warning", low: "neutral", unknown: "neutral" },
};

const LABELS: Record<string, string> = {
  at_risk: "At risk",
  waiting_client: "Waiting on client",
  waiting_approval: "Waiting for approval",
  in_progress: "In progress",
  changes_requested: "Changes requested",
  requires_approval: "Needs approval",
  no_action: "No action",
  internal: "Mea Creo approval",
  client: "Client approval",
  manual: "Manual",
  audit_generated: "Report generated",
  CONNECTED: "Connected",
  ACTION_REQUIRED: "Action required",
  ERROR: "Error",
  NOT_CONNECTED: "Not connected",
  client_approval: "Client approval",
  internal_review: "Internal review",
};

export function statusLabel(value: string): string {
  return LABELS[value] ?? humanize(value);
}

export function StatusBadge({ kind, value }: { kind: keyof typeof MAPS; value: string }) {
  return (
    <Badge tone={MAPS[kind]?.[value] ?? "neutral"} dot>
      {statusLabel(value)}
    </Badge>
  );
}

const HEALTH_ICON = {
  healthy: { icon: CheckCircle2, className: "text-success-700", label: "Healthy" },
  watch: { icon: AlertTriangle, className: "text-warning-700", label: "Watch" },
  at_risk: { icon: XCircle, className: "text-danger-700", label: "At risk" },
  paused: { icon: PauseCircle, className: "text-subtle", label: "Paused" },
} as const;

export function HealthLabel({
  value,
  showText = true,
}: {
  value: keyof typeof HEALTH_ICON | string;
  showText?: boolean;
}) {
  const h = HEALTH_ICON[value as keyof typeof HEALTH_ICON] ?? {
    icon: CircleDashed,
    className: "text-subtle",
    label: humanize(value),
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <h.icon className={`size-4 ${h.className}`} aria-hidden />
      {showText ? <span>{h.label}</span> : <span className="sr-only">{h.label}</span>}
    </span>
  );
}

export function DueLabel({ due, done }: { due: Date | null; done?: boolean }) {
  if (!due) return <span className="text-subtle text-sm">No due date</span>;
  // Rendered on the server per request, so reading the clock here is intentional.
  // eslint-disable-next-line react-hooks/purity
  const overdue = !done && due.getTime() < Date.now();
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${overdue ? "text-danger-700 font-medium" : "text-muted"}`}
    >
      <Clock className="size-3.5" aria-hidden />
      {overdue ? "Overdue · " : ""}
      {due.toLocaleDateString("en-ZA", {
        timeZone: "Africa/Johannesburg",
        day: "numeric",
        month: "short",
      })}
    </span>
  );
}
