import Link from "next/link";
import {
  doNotContactAction,
  draftOutreachAction,
  logResponseAction,
  markSentAction,
  recordConsentAction,
} from "@/app/workspace/leads/outreach-actions";
import {
  ActionForm,
  CheckboxField,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "@/components/ui/form";
import { Badge, Callout } from "@/components/ui/primitives";
import { CHANNELS, type communications, RESPONSE_CLASSES } from "@/db/schema";
import { fmtDateTime, humanize } from "@/lib/format";
import type { OutreachCheck } from "@/modules/outreach/service";

type Communication = typeof communications.$inferSelect;

const STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger" | "info"> = {
  sent: "success",
  received: "info",
  pending_approval: "warning",
  approved: "warning",
  failed: "danger",
  cancelled: "neutral",
  draft: "neutral",
};

const CLASS_TONE: Partial<Record<string, "success" | "warning" | "danger" | "neutral">> = {
  positive: "success",
  interested: "success",
  wants_call: "success",
  wants_proposal: "success",
  needs_information: "warning",
  opt_out: "danger",
  not_interested: "neutral",
};

/** Outreach for one prospect: compliance status, drafting, history and replies. */
export function OutreachPanel({
  leadId,
  check,
  history,
  canWrite,
}: {
  leadId: string;
  check: OutreachCheck;
  history: Communication[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-5">
      {check.blocked ? (
        <Callout tone="danger" title="Outreach blocked">
          {check.reasons.join(" ")}
        </Callout>
      ) : check.consentRequestOnly ? (
        <Callout tone="info" title="First contact: ask permission only">
          They haven&apos;t agreed to hear from us. POPIA allows one message asking whether
          they&apos;d like to; the draft will do exactly that, with an easy way to say no.
        </Callout>
      ) : (
        <Callout tone="success" title="They've agreed to hear from us">
          Every message still needs your approval before it goes out.
        </Callout>
      )}
      {check.warnings.length > 0 && (
        <p className="text-warning-700 text-sm">{check.warnings.join(" ")}</p>
      )}

      {canWrite && !check.blocked && (
        <ActionForm action={draftOutreachAction} className="space-y-3">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              name="channel"
              label="Channel"
              options={CHANNELS.map((c) => ({ value: c, label: humanize(c) }))}
            />
            <SelectField
              name="purpose"
              label="Purpose"
              options={
                check.consentRequestOnly
                  ? [{ value: "consent_request", label: "Ask permission (first contact)" }]
                  : [
                      { value: "follow_up", label: "Follow up with observations" },
                      { value: "booking_link", label: "Send booking link" },
                      { value: "information", label: "Answer a question" },
                      { value: "reply", label: "Blank reply" },
                    ]
              }
            />
          </div>
          <CheckboxField
            name="useAi"
            label="Improve the draft with AI"
            hint="Uses the configured AI provider within budget; falls back to the template."
          />
          <SubmitButton size="sm">Draft for approval</SubmitButton>
          <p className="text-subtle text-xs">
            Email is sent by the system after approval, with an unsubscribe link. LinkedIn, phone
            and WhatsApp messages are sent by you; nothing is automated on those platforms.
          </p>
        </ActionForm>
      )}

      <div>
        <h3 className="text-sm font-semibold">History</h3>
        {history.length === 0 ? (
          <p className="text-muted mt-1 text-sm">No messages yet.</p>
        ) : (
          <ol className="mt-2 space-y-3">
            {history.map((c) => (
              <li key={c.id} className="border-border rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={c.direction === "inbound" ? "info" : "neutral"}>
                    {c.direction === "inbound" ? "Reply" : "Outbound"} · {humanize(c.channel)}
                  </Badge>
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{humanize(c.status)}</Badge>
                  {c.classification && (
                    <Badge tone={CLASS_TONE[c.classification] ?? "neutral"}>
                      {humanize(c.classification)}
                    </Badge>
                  )}
                  <span className="text-muted text-xs">
                    {fmtDateTime(c.sentAt ?? c.receivedAt ?? c.createdAt)}
                  </span>
                </div>
                {c.subject && <p className="mt-2 font-medium">{c.subject}</p>}
                <p className="text-ink-soft mt-1 whitespace-pre-wrap">
                  {c.body.length > 600 ? `${c.body.slice(0, 600)}…` : c.body}
                </p>
                {c.nextAction && <p className="text-muted mt-2 text-xs">Next: {c.nextAction}</p>}
                {c.meta.blockedReason && (
                  <p className="text-danger-700 mt-2 text-xs">Not sent: {c.meta.blockedReason}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.status === "pending_approval" && c.approvalId && (
                    <Link
                      href={`/workspace/approvals/${c.approvalId}`}
                      className="text-brand-700 text-xs hover:underline"
                    >
                      Review &amp; approve →
                    </Link>
                  )}
                  {canWrite && c.status === "approved" && c.channel !== "email" && (
                    <ActionForm action={markSentAction}>
                      <input type="hidden" name="communicationId" value={c.id} />
                      <SubmitButton size="sm" variant="secondary">
                        I&apos;ve sent it
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {canWrite && (
        <details className="border-border rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Log a reply</summary>
          <ActionForm action={logResponseAction} className="mt-3 space-y-3" resetOnSuccess>
            <input type="hidden" name="leadId" value={leadId} />
            <TextArea
              name="body"
              label="Their reply"
              rows={4}
              hint="Paste it, or summarise a call. It's classified automatically and the next step is prepared for approval."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField
                name="channel"
                label="Channel"
                options={CHANNELS.map((c) => ({ value: c, label: humanize(c) }))}
              />
              <SelectField
                name="classification"
                label="Classification"
                options={[
                  { value: "", label: "Classify automatically" },
                  ...RESPONSE_CLASSES.map((c) => ({ value: c, label: humanize(c) })),
                ]}
              />
            </div>
            <SubmitButton size="sm" variant="secondary">
              Log reply
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

/** Consent and do-not-contact controls for the lead sidebar. */
export function ConsentControls({
  leadId,
  consentStatus,
  consentText,
  optedOutAt,
}: {
  leadId: string;
  consentStatus: string;
  consentText: string | null;
  optedOutAt: Date | null;
}) {
  return (
    <div className="space-y-4 text-sm">
      <p>
        Status:{" "}
        <Badge
          tone={
            consentStatus === "given"
              ? "success"
              : consentStatus === "unknown"
                ? "neutral"
                : "danger"
          }
        >
          {humanize(consentStatus)}
        </Badge>
      </p>
      {consentText && <p className="text-muted text-xs">{consentText}</p>}
      {optedOutAt ? (
        <p className="text-danger-700 text-xs">
          Opted out {fmtDateTime(optedOutAt)}. Every channel is suppressed.
        </p>
      ) : (
        <>
          {consentStatus !== "given" && (
            <details>
              <summary className="text-brand-700 cursor-pointer text-xs">
                Record that they agreed
              </summary>
              <ActionForm action={recordConsentAction} className="mt-2 space-y-2">
                <input type="hidden" name="leadId" value={leadId} />
                <TextField name="how" label="How and when" />
                <SubmitButton size="sm" variant="secondary">
                  Record consent
                </SubmitButton>
              </ActionForm>
            </details>
          )}
          <details>
            <summary className="text-danger-700 cursor-pointer text-xs">Do not contact</summary>
            <ActionForm action={doNotContactAction} className="mt-2 space-y-2">
              <input type="hidden" name="leadId" value={leadId} />
              <CheckboxField
                name="confirm"
                label="Suppress every channel for this person"
                hint="Cancels pending messages. Use when someone asks not to be contacted."
              />
              <SubmitButton size="sm" variant="secondary">
                Add to do-not-contact list
              </SubmitButton>
            </ActionForm>
          </details>
        </>
      )}
    </div>
  );
}
