import "server-only";
import { and, count, desc, eq, gte, inArray, or, type SQL } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  approvals,
  clients,
  communications,
  leadActivities,
  leads,
  suppressions,
  tasks,
  type Channel,
  type ResponseClass,
} from "@/db/schema";
import { runAgent } from "@/agents/runtime";
import { absoluteUrl } from "@/lib/urls";
import { AppError } from "@/lib/errors";
import { startOfDayTz } from "@/lib/format";
import { sendEmail } from "@/modules/email/service";
import { getPlatformSetting } from "@/modules/settings/service";
import { classifyResponse, nextActionFor } from "./classify";
import { checkOutreachQuality, composeOutreach, type OutreachPurpose } from "./compose";
import {
  businessDomain,
  linkedinPath,
  normaliseEmail,
  normalisePhoneDigits,
  unsubscribeToken,
} from "./identifiers";

type Lead = typeof leads.$inferSelect;
type Communication = typeof communications.$inferSelect;

/**
 * Channels treated as electronic communication for direct marketing (POPIA s69). Phone
 * calls are included: the Information Regulator treats direct-marketing calls this way,
 * and it is the safer reading either way.
 */
const ELECTRONIC: Channel[] = ["email", "whatsapp", "linkedin", "contact_form", "phone", "other"];

export interface OutreachCheck {
  /** Drafting and sending are both blocked. */
  blocked: boolean;
  reasons: string[];
  /** Consent unknown: only one message, asking permission, may go out. */
  consentRequestOnly: boolean;
  /** Today's send limit is reached (drafting still allowed). */
  dailyLimitReached: boolean;
  warnings: string[];
}

async function internalOrganisationId(db: DbOrTx): Promise<string> {
  const [row] = await db
    .select({ id: clients.organisationId })
    .from(clients)
    .where(eq(clients.isInternal, true))
    .limit(1);
  if (!row) throw new AppError("INTERNAL", { message: "Internal client missing: run the seed." });
  return row.id;
}

/** Every identifier we hold for a lead, normalised for the suppression list. */
export function leadIdentifiers(lead: Pick<Lead, "email" | "phone" | "linkedinUrl" | "website">) {
  const ids: { kind: "email" | "phone" | "linkedin" | "domain"; identifier: string }[] = [];
  if (lead.email) ids.push({ kind: "email", identifier: normaliseEmail(lead.email) });
  if (lead.phone) ids.push({ kind: "phone", identifier: normalisePhoneDigits(lead.phone) });
  const li = lead.linkedinUrl && linkedinPath(lead.linkedinUrl);
  if (li) ids.push({ kind: "linkedin", identifier: li });
  return ids;
}

export async function findSuppression(db: DbOrTx, lead: Lead) {
  const ids = leadIdentifiers(lead);
  const domain = lead.email ? businessDomain(lead.email) : null;
  if (domain) ids.push({ kind: "domain", identifier: domain });
  if (!ids.length) return null;
  const [hit] = await db
    .select()
    .from(suppressions)
    .where(
      or(
        ...ids.map((i) =>
          and(eq(suppressions.kind, i.kind), eq(suppressions.identifier, i.identifier)),
        ),
      ),
    )
    .limit(1);
  return hit ?? null;
}

/** Whether someone has agreed to hear from us, or approached us themselves. */
export async function hasConsent(db: DbOrTx, lead: Lead): Promise<boolean> {
  if (lead.consentStatus === "given") return true;
  if (lead.consentStatus !== "unknown") return false;
  if (lead.consentAt) return true;
  // They approached us (contact form, booking, report request): replying isn't cold outreach.
  if (["contact_form", "booking", "visibility_report"].includes(lead.source)) return true;
  const [inbound] = await db
    .select({ id: communications.id })
    .from(communications)
    .where(and(eq(communications.leadId, lead.id), eq(communications.direction, "inbound")))
    .limit(1);
  return Boolean(inbound);
}

async function sentToday(db: DbOrTx): Promise<number> {
  const start = startOfDayTz();
  const [row] = await db
    .select({ n: count() })
    .from(communications)
    .where(
      and(
        eq(communications.direction, "outbound"),
        eq(communications.status, "sent"),
        gte(communications.sentAt, start),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * The compliance gate. Runs when a draft is created AND again at the moment of sending,
 * so an opt-out received in between always wins.
 */
export async function checkOutreach(
  db: DbOrTx,
  lead: Lead,
  channel: Channel,
): Promise<OutreachCheck> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (lead.optedOutAt || lead.consentStatus === "withdrawn")
    reasons.push("They asked not to be contacted.");
  else if (lead.consentStatus === "withheld")
    reasons.push(
      "They said they're not interested. Don't contact them again unless they reach out.",
    );
  const suppressed = await findSuppression(db, lead);
  if (suppressed)
    reasons.push(
      `On the do-not-contact list (${suppressed.kind}: ${suppressed.reason.replace("_", " ")}).`,
    );
  if (["lost", "archived", "active_client"].includes(lead.stage) && !reasons.length)
    warnings.push(`This lead is ${lead.stage.replace("_", " ")}.`);
  if (channel === "email" && !lead.email) reasons.push("No email address on record.");
  if (channel === "linkedin" && !lead.linkedinUrl) warnings.push("No LinkedIn profile on record.");
  if (channel === "phone" && !lead.phone) reasons.push("No phone number on record.");

  const consent = await hasConsent(db, lead);
  let consentRequestOnly = false;
  if (!consent && ELECTRONIC.includes(channel)) {
    const [prior] = await db
      .select({ id: communications.id, status: communications.status })
      .from(communications)
      .where(
        and(
          eq(communications.leadId, lead.id),
          eq(communications.direction, "outbound"),
          inArray(communications.status, ["sent", "approved", "pending_approval"]),
        ),
      )
      .limit(1);
    if (prior)
      reasons.push(
        prior.status === "sent"
          ? "We've already asked permission once with no reply. POPIA allows only one approach without consent."
          : "A first message is already waiting for approval or sending.",
      );
    else consentRequestOnly = true;
  }
  const outreach = await getPlatformSetting(db, "outreach");
  const dailyLimitReached = (await sentToday(db)) >= outreach.maxPerDay;
  if (dailyLimitReached)
    warnings.push(`Today's limit of ${outreach.maxPerDay} messages is reached.`);
  return { blocked: reasons.length > 0, reasons, consentRequestOnly, dailyLimitReached, warnings };
}

/**
 * Drafts one message for Dylan's approval. Nothing is sent from here: the approval
 * executes the send (email) or creates a task for a person (LinkedIn, phone, WhatsApp).
 */
export async function draftOutreach(
  db: DbOrTx,
  leadId: string,
  input: {
    channel: Channel;
    purpose?: OutreachPurpose;
    actorId?: string;
    useAi?: boolean;
    runId?: string;
    /** Edited text replaces the generated draft. */
    subject?: string;
    body?: string;
  },
): Promise<{ communicationId: string; approvalId: string | null; qcIssues: string[] }> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new AppError("NOT_FOUND");
  const check = await checkOutreach(db, lead, input.channel);
  if (check.blocked) throw new AppError("CONFLICT", { userMessage: check.reasons.join(" ") });
  const purpose: OutreachPurpose = check.consentRequestOnly
    ? "consent_request"
    : (input.purpose ?? "follow_up");
  const outreach = await getPlatformSetting(db, "outreach");
  const sender = { name: outreach.senderName, title: outreach.senderTitle };
  const composed = composeOutreach(lead, purpose, input.channel, sender, {
    bookingUrl: absoluteUrl("/book"),
  });
  const orgId = await internalOrganisationId(db);

  let body = input.body?.trim() || composed.body;
  let source = input.body ? "edited" : "template";
  if (!input.body && input.useAi) {
    const brief = lead.brief;
    const draft = await runAgent(db, {
      agent: "outreach",
      action: "write.outreach_drafts",
      organisationId: orgId,
      runId: input.runId,
      input: { leadId, purpose, channel: input.channel },
      prompt: {
        system: `You write short, personal ${input.channel} messages from ${sender.name} (${sender.title}) to business decision makers. Under 120 words, plain text, warm and direct, no hype, no buzzwords, no "Dear Sir/Madam", never claim to be "leading", no guarantees, no prices. ${purpose === "consent_request" ? "This is a first contact: share ONE specific observation, ask whether they would like the observations, and end with: If you'd rather not hear from me, just reply \"no thanks\" and I won't contact you again." : ""} Use only the facts given.`,
        user: `Company: ${lead.company}\nContact: ${lead.contactName ?? "unknown"}${lead.contactRole ? ` (${lead.contactRole})` : ""}\nIndustry: ${lead.industry ?? "unknown"}\nPurpose: ${purpose}\nWhy contact: ${brief?.whyContact ?? ""}\nObservations: ${[...(brief?.leadGenerationOpportunities ?? []), ...(brief?.seoOpportunities ?? [])].slice(0, 3).join(" | ")}\n\nTemplate to improve on:\n${composed.body}`,
        maxTokens: 500,
      },
      rules: () => composed.body,
    });
    if (draft.status === "succeeded") {
      body = draft.text.trim();
      source = draft.source === "ai" ? "AI" : "template";
    }
  }
  const subject = input.channel === "email" ? input.subject?.trim() || composed.subject : null;
  const qc = checkOutreachQuality(body, { firstContact: purpose === "consent_request" });
  const [comm] = await db
    .insert(communications)
    .values({
      leadId,
      campaignId: lead.campaignId,
      direction: "outbound",
      channel: input.channel,
      purpose,
      status: "pending_approval",
      toName: lead.contactName,
      toAddress:
        input.channel === "email"
          ? lead.email
          : input.channel === "linkedin"
            ? lead.linkedinUrl
            : lead.phone,
      subject,
      body,
      rationale: composed.rationale,
      createdById: input.actorId,
      meta: { source },
    })
    .returning();

  const { requestApproval } = await import("@/modules/approvals/service");
  const manual = input.channel !== "email";
  const approval = await requestApproval(db, {
    organisationId: orgId,
    // Outreach is never automatic: a person approves every message.
    level: "internal",
    type: "outreach",
    title: `${manual ? "Approve" : "Send"} ${input.channel === "email" ? "email" : input.channel} to ${lead.contactName ?? lead.company}${lead.contactName ? ` (${lead.company})` : ""}`,
    description: [
      composed.rationale,
      `${source.charAt(0).toUpperCase()}${source.slice(1)} draft.`,
      manual ? "After approval you send it yourself; nothing is automated on this channel." : "",
      qc.passed
        ? ""
        : `QC blocks: ${qc.issues
            .filter((i) => i.severity === "block")
            .map((i) => i.rule)
            .join(", ")}. Edit before approving.`,
      ...check.warnings,
    ]
      .filter(Boolean)
      .join(" "),
    preview: subject ? `Subject: ${subject}\n\n${body}` : body,
    requestedAction: manual ? "Approve (I'll send it)" : "Approve & send",
    requestedById: input.actorId,
    requestedByAgent: input.actorId ? undefined : "outreach",
    runId: input.runId,
    entityType: "lead",
    entityId: leadId,
    action: { type: "outreach.send", payload: { communicationId: comm.id, leadId } },
  });
  await db
    .update(communications)
    .set({ approvalId: approval.id })
    .where(eq(communications.id, comm.id));
  await db.insert(leadActivities).values({
    leadId,
    type: "outreach",
    summary: `${input.channel} ${purpose.replace("_", " ")} drafted for approval.`,
    actorId: input.actorId,
  });
  return {
    communicationId: comm.id,
    approvalId: approval.id,
    qcIssues: qc.issues.map((i) => `${i.rule}: ${i.detail}`),
  };
}

function footer(company: { legalName: string; email: string }, leadId: string) {
  const url = absoluteUrl(`/unsubscribe/${unsubscribeToken(leadId)}`);
  return {
    url,
    text: `\n\n--\n${company.legalName} · ${company.email}\nDon't want to hear from us? ${url}`,
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/**
 * Executes an approved outbound message. Re-checks compliance first. Email goes
 * through the email provider with an opt-out link; other channels become a task for
 * a person, and the message is marked sent when they confirm.
 */
export async function sendApprovedCommunication(
  db: DbOrTx,
  communicationId: string,
): Promise<{ status: "sent" | "manual" | "blocked" | "failed"; reason?: string }> {
  const [comm] = await db
    .select()
    .from(communications)
    .where(eq(communications.id, communicationId))
    .limit(1);
  if (!comm || !comm.leadId) return { status: "failed", reason: "Message not found." };
  if (comm.status === "sent") return { status: "sent" };
  const [lead] = await db.select().from(leads).where(eq(leads.id, comm.leadId)).limit(1);
  if (!lead) return { status: "failed", reason: "Lead not found." };

  const check = await checkOutreach(db, lead, comm.channel);
  // A pending first message must not block itself.
  const blocking = check.reasons.filter((r) => !r.startsWith("A first message is already waiting"));
  if (blocking.length || check.dailyLimitReached) {
    const reason = blocking.length ? blocking.join(" ") : check.warnings.join(" ");
    await db
      .update(communications)
      .set({
        status: blocking.length ? "cancelled" : "approved",
        meta: { ...comm.meta, blockedReason: reason },
      })
      .where(eq(communications.id, comm.id));
    if (!blocking.length) {
      const orgId = await internalOrganisationId(db);
      await db.insert(tasks).values({
        organisationId: orgId,
        title: `Send approved message to ${lead.company} tomorrow (daily limit reached)`,
        status: "ready",
        source: "workflow",
        visibility: "internal",
      });
    }
    return { status: "blocked", reason };
  }

  if (comm.channel === "email") {
    const company = await getPlatformSetting(db, "company");
    const f = footer(company, lead.id);
    const text = comm.body + f.text;
    const result = await sendEmail(db, {
      to: { email: comm.toAddress ?? lead.email!, name: lead.contactName ?? undefined },
      template: `outreach.${comm.purpose}`,
      category: "outbound",
      email: {
        subject: comm.subject ?? lead.company,
        text,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${escapeHtml(comm.body)}</div><p style="font-family:Helvetica,Arial,sans-serif;color:#777;font-size:12px;margin-top:24px">${escapeHtml(company.legalName)} · ${escapeHtml(company.email)}<br><a href="${f.url}">Don't want to hear from us? Unsubscribe</a></p>`,
      },
      unsubscribeUrl: f.url,
      replyTo: company.email,
      idempotencyKey: `communication:${comm.id}`,
    });
    if (result.status !== "sent") {
      await db
        .update(communications)
        .set({ status: "failed", meta: { ...comm.meta, error: result.status } })
        .where(eq(communications.id, comm.id));
      return { status: "failed", reason: `Email ${result.status}.` };
    }
    await markSent(db, comm, lead);
    return { status: "sent" };
  }

  await db.update(communications).set({ status: "approved" }).where(eq(communications.id, comm.id));
  const orgId = await internalOrganisationId(db);
  await db.insert(tasks).values({
    organisationId: orgId,
    title: `Send approved ${comm.channel} message to ${lead.contactName ?? lead.company}`,
    description: `Open the lead, copy the approved message, send it yourself, then click "Mark as sent".\n\n${comm.body}`,
    status: "ready",
    priority: "high",
    source: "workflow",
    visibility: "internal",
  });
  return { status: "manual" };
}

async function markSent(db: DbOrTx, comm: Communication, lead: Lead, actorId?: string) {
  await db
    .update(communications)
    .set({ status: "sent", sentAt: new Date(), sentById: actorId })
    .where(eq(communications.id, comm.id));
  await db.insert(leadActivities).values({
    leadId: lead.id,
    type: "outreach",
    summary: `${comm.channel} sent${comm.subject ? `: ${comm.subject}` : ""}`,
    actorId,
  });
  await db
    .update(leads)
    .set({
      stage: ["new", "audit_generated", "qualified"].includes(lead.stage)
        ? "contacted"
        : lead.stage,
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, lead.id));
}

/** For manual channels: the person confirms they sent the approved message. */
export async function markCommunicationSent(db: DbOrTx, communicationId: string, actorId: string) {
  const [comm] = await db
    .select()
    .from(communications)
    .where(eq(communications.id, communicationId))
    .limit(1);
  if (!comm?.leadId) throw new AppError("NOT_FOUND");
  if (comm.status !== "approved")
    throw new AppError("CONFLICT", {
      userMessage: "Only approved messages can be marked as sent.",
    });
  const [lead] = await db.select().from(leads).where(eq(leads.id, comm.leadId)).limit(1);
  const check = await checkOutreach(db, lead!, comm.channel);
  const blocking = check.reasons.filter((r) => !r.startsWith("A first message is already waiting"));
  if (blocking.length) throw new AppError("CONFLICT", { userMessage: blocking.join(" ") });
  await markSent(db, comm, lead!, actorId);
}

/** Adds every identifier of a lead to the do-not-contact list and closes open drafts. */
export async function suppressLead(
  db: DbOrTx,
  leadId: string,
  reason: "opt_out" | "bounce" | "complaint" | "manual",
  source: string,
  actorId?: string,
) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new AppError("NOT_FOUND");
  const ids = leadIdentifiers(lead);
  for (const id of ids)
    await db
      .insert(suppressions)
      .values({ ...id, reason, source, leadId, createdById: actorId })
      .onConflictDoNothing();
  await db
    .update(leads)
    .set({
      consentStatus: "withdrawn",
      optedOutAt: lead.optedOutAt ?? new Date(),
      marketingOptIn: false,
      lastActivityAt: new Date(),
    })
    .where(eq(leads.id, leadId));
  const pending = await db
    .select({ id: communications.id, approvalId: communications.approvalId })
    .from(communications)
    .where(
      and(
        eq(communications.leadId, leadId),
        eq(communications.direction, "outbound"),
        inArray(communications.status, ["draft", "pending_approval", "approved"]),
      ),
    );
  if (pending.length) {
    await db
      .update(communications)
      .set({ status: "cancelled" })
      .where(
        inArray(
          communications.id,
          pending.map((p) => p.id),
        ),
      );
    const approvalIds = pending.map((p) => p.approvalId).filter((x): x is string => Boolean(x));
    if (approvalIds.length)
      await db
        .update(approvals)
        .set({
          status: "rejected",
          decidedAt: new Date(),
          decisionComment: "Cancelled automatically: the person opted out.",
        })
        .where(and(inArray(approvals.id, approvalIds), eq(approvals.status, "pending")));
  }
  await db.insert(leadActivities).values({
    leadId,
    type: "response",
    summary: `Opted out (${source}). Added to the do-not-contact list; ${pending.length} pending message(s) cancelled.`,
    actorId,
  });
}

/**
 * Logs a reply (pasted from email, LinkedIn, WhatsApp or a call note), classifies it,
 * and applies the workflow for that class. Anything external it prepares still
 * needs approval.
 */
export async function logResponse(
  db: DbOrTx,
  leadId: string,
  input: {
    channel: Channel;
    body: string;
    subject?: string;
    receivedAt?: Date;
    actorId?: string;
    /** Dylan's correction of the automatic class. */
    classification?: ResponseClass;
  },
): Promise<{ communicationId: string; classification: ResponseClass; nextAction: string }> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new AppError("NOT_FOUND");
  const auto = classifyResponse(input.body);
  const cls = input.classification ?? auto.class;
  const nextAction = nextActionFor(cls);
  const [comm] = await db
    .insert(communications)
    .values({
      leadId,
      direction: "inbound",
      channel: input.channel,
      purpose: "reply",
      status: "received",
      subject: input.subject,
      body: input.body,
      classification: cls,
      classificationReason: input.classification ? "Set by Mea Creo" : auto.reason,
      nextAction,
      receivedAt: input.receivedAt ?? new Date(),
      createdById: input.actorId,
    })
    .returning({ id: communications.id });
  await db.insert(leadActivities).values({
    leadId,
    type: "response",
    summary: `Reply via ${input.channel}: ${cls.replace(/_/g, " ")}. ${nextAction}`,
    actorId: input.actorId,
  });
  await applyResponseWorkflow(db, lead, cls, input.actorId);
  return { communicationId: comm.id, classification: cls, nextAction };
}

async function applyResponseWorkflow(db: DbOrTx, lead: Lead, cls: ResponseClass, actorId?: string) {
  const orgId = await internalOrganisationId(db);
  const task = (title: string, description?: string) =>
    db.insert(tasks).values({
      organisationId: orgId,
      title,
      description,
      status: "ready",
      priority: "high",
      source: "workflow",
      visibility: "internal",
    });
  const giveConsent = () =>
    db
      .update(leads)
      .set({
        consentStatus: "given",
        consentAt: lead.consentAt ?? new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(leads.id, lead.id));
  const channel: Channel = lead.email ? "email" : lead.linkedinUrl ? "linkedin" : "phone";
  const draft = async (purpose: OutreachPurpose) => {
    try {
      await draftOutreach(db, lead.id, { channel, purpose, actorId });
    } catch {
      await task(
        `Reply to ${lead.company}`,
        `Couldn't draft automatically. ${nextActionFor("other")}`,
      );
    }
  };

  switch (cls) {
    case "opt_out":
      await suppressLead(db, lead.id, "opt_out", "reply", actorId);
      await db
        .update(leads)
        .set({ stage: "lost", lostReason: "Asked not to be contacted" })
        .where(eq(leads.id, lead.id));
      break;
    case "not_interested":
      await db
        .update(leads)
        .set({
          consentStatus: "withheld",
          stage: "lost",
          lostReason: "Not interested",
          lastActivityAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
      break;
    case "wants_call":
      await giveConsent();
      await draft("booking_link");
      break;
    case "wants_proposal":
      await giveConsent();
      await task(
        `Prepare a proposal for ${lead.company}`,
        "They asked for a proposal or pricing. Book a scoping call first if the need isn't clear, then create the proposal from the lead page.",
      );
      await draft("booking_link");
      break;
    case "interested":
    case "positive":
      await giveConsent();
      await draft("follow_up");
      break;
    case "needs_information":
      await giveConsent();
      await draft("information");
      break;
    case "wrong_person":
      await task(
        `Find the right contact at ${lead.company}`,
        "The person we contacted isn't the right one. Update the contact, then ask permission again.",
      );
      break;
    case "out_of_office":
      await task(`Follow up with ${lead.company} after their return`);
      break;
    case "unclear":
    case "other":
      await task(`Read and reply: ${lead.company}`);
      break;
    case "spam":
      break;
  }
}

/** One prospect's full history, newest first. */
export async function communicationHistory(db: DbOrTx, leadId: string) {
  return db
    .select()
    .from(communications)
    .where(eq(communications.leadId, leadId))
    .orderBy(desc(communications.createdAt));
}

/** Numbers and lists for the Outreach page. */
export async function loadOutreachOverview(
  db: DbOrTx,
  tab: "queue" | "replies" | "sent" | "suppressed",
) {
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const filters = {
    queue: and(
      eq(communications.direction, "outbound"),
      inArray(communications.status, ["pending_approval", "approved"]),
    ),
    replies: and(eq(communications.direction, "inbound"), gte(communications.createdAt, since30)),
    sent: and(eq(communications.direction, "outbound"), eq(communications.status, "sent")),
  };
  const countWhere = (where: SQL | undefined) =>
    db
      .select({ n: count() })
      .from(communications)
      .where(where)
      .then((r) => Number(r[0]?.n ?? 0));
  const [settings, today, sent30, replies30, optOuts30, queueCount, rows, suppressed] =
    await Promise.all([
      getPlatformSetting(db, "outreach"),
      sentToday(db),
      countWhere(and(filters.sent, gte(communications.sentAt, since30))),
      countWhere(filters.replies),
      countWhere(and(filters.replies, eq(communications.classification, "opt_out"))),
      countWhere(filters.queue),
      tab === "suppressed"
        ? Promise.resolve([])
        : db
            .select({ c: communications, company: leads.company, leadId: leads.id })
            .from(communications)
            .leftJoin(leads, eq(leads.id, communications.leadId))
            .where(filters[tab])
            .orderBy(desc(communications.createdAt))
            .limit(100),
      tab === "suppressed"
        ? db.select().from(suppressions).orderBy(desc(suppressions.createdAt)).limit(500)
        : Promise.resolve([]),
    ]);
  return { settings, sentToday: today, sent30, replies30, optOuts30, queueCount, rows, suppressed };
}
