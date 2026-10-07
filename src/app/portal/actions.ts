"use server";

import { and, eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { approvals, invoices, messages, serviceRequests, services } from "@/db/schema";
import { type ActionState, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/urls";
import { logActivity } from "@/modules/activity/log";
import { decideApproval } from "@/modules/approvals/service";
import { askMeaCreo } from "@/modules/assistant/service";
import { enforceRateLimit } from "@/modules/auth/rate-limit";
import { requireClient } from "@/modules/auth/context";
import { startCheckout } from "@/modules/billing/service";
import { setClientLogo } from "@/modules/clients/logo";
import { uploadDocument } from "@/modules/documents/service";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { bookClientMeeting } from "@/modules/meetings/service";
import { emitEvent, notifyStaff } from "@/modules/notifications/service";
import { inviteClientUser } from "@/modules/onboarding/service";
import { prospectStatusSchema, setProspectStatus } from "@/modules/prospecting/service";

const clientActor = (ctx: Awaited<ReturnType<typeof requireClient>>) => ({
  type: "client" as const,
  id: ctx.user.id,
  label: ctx.user.name,
});

export async function portalDecideAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.approve");
    const input = z
      .object({
        approvalId: z.uuid(),
        decision: z.enum(["approved", "changes_requested", "rejected"]),
        comment: z.string().trim().max(2000).optional(),
      })
      .parse({
        approvalId: fd.get("approvalId"),
        decision: fd.get("decision"),
        comment: fd.get("comment") ?? undefined,
      });
    if (input.decision !== "approved" && !input.comment)
      return { ok: false, fieldErrors: { comment: ["Tell us what to change so we can fix it."] } };
    const db = await getDb();
    // Organisation scoping: the approval must belong to the session's organisation.
    const [a] = await db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(eq(approvals.id, input.approvalId), eq(approvals.organisationId, ctx.organisationId)),
      );
    if (!a) throw new AppError("NOT_FOUND");
    await decideApproval(db, ctx, input.approvalId, input.decision, input.comment);
    refresh();
    return {
      ok: true,
      message:
        input.decision === "approved" ? "Approved. Thank you." : "Thanks, we'll make the changes.",
    };
  }, fd);
}

export async function portalMessageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient();
    const parsed = parseForm(
      z.object({
        body: z.string().trim().min(2, "Write a message.").max(5000),
        kind: z.enum(["message", "support"]).default("message"),
        subject: z.string().trim().max(160).optional(),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    await enforceRateLimit(db, `portal-msg:${ctx.user.id}`, 30, 3600);
    await db.insert(messages).values({
      organisationId: ctx.organisationId,
      authorId: ctx.user.id,
      fromClient: true,
      kind: parsed.data.kind,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
    });
    await notifyStaff(db, {
      kind: "message.received",
      title: `${ctx.organisationName}: new ${parsed.data.kind === "support" ? "support request" : "message"}`,
      body: parsed.data.body.slice(0, 140),
      link: `/workspace/clients/${ctx.organisationId}?tab=messages`,
      organisationId: ctx.organisationId,
    });
    await emitEvent(db, "message.received", ctx.organisationId, {
      support: parsed.data.kind === "support",
    });
    refresh();
    return { ok: true, message: "Sent. We usually reply within one working day." };
  }, fd);
}

export async function portalUploadAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.upload");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, fieldErrors: { file: ["Choose a file."] } };
    const db = await getDb();
    await enforceRateLimit(db, `portal-upload:${ctx.user.id}`, 60, 3600);
    await uploadDocument(db, {
      organisationId: ctx.organisationId,
      file,
      category: String(fd.get("category") ?? "") || undefined,
      visibility: "client",
      actor: clientActor(ctx),
      uploadedById: ctx.user.id,
      byClient: true,
      description: String(fd.get("description") ?? "").slice(0, 300) || undefined,
    });
    refresh();
    return { ok: true, message: `Uploaded ${file.name}.` };
  }, fd);
}

export async function portalBookAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient();
    const parsed = parseForm(
      z.object({
        slot: z.iso.datetime({ message: "Choose a time." }),
        topic: z.string().trim().min(3, "What would you like to discuss?").max(300),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    await bookClientMeeting(await getDb(), {
      organisationId: ctx.organisationId,
      userId: ctx.user.id,
      userName: ctx.user.name,
      userEmail: ctx.user.email,
      ...parsed.data,
    });
    refresh();
    return { ok: true, message: "Booked. You'll find it under upcoming meetings." };
  }, fd);
}

export async function portalPayAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.billing");
    const db = await getDb();
    const id = String(fd.get("invoiceId"));
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.organisationId, ctx.organisationId),
          inArray(invoices.status, ["open", "overdue"]),
        ),
      );
    if (!invoice) return { ok: false, message: "This invoice doesn't need payment." };
    const checkout = await startCheckout(db, {
      organisationId: ctx.organisationId,
      invoiceId: invoice.id,
      customer: { email: ctx.user.email, name: ctx.user.name },
    });
    return { ok: true, data: { checkout } };
  }, fd);
}

export async function portalRequestServiceAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient();
    const db = await getDb();
    const serviceId = String(fd.get("serviceId"));
    const [service] = await db
      .select({ id: services.id, name: services.name })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.status, "active")));
    if (!service) throw new AppError("NOT_FOUND");
    await db.insert(serviceRequests).values({
      organisationId: ctx.organisationId,
      serviceId,
      requestedById: ctx.user.id,
      note: String(fd.get("note") ?? "").slice(0, 1000) || null,
    });
    await notifyStaff(db, {
      kind: "service.requested",
      title: `${ctx.organisationName} asked about ${service.name}`,
      link: `/workspace/clients/${ctx.organisationId}?tab=services`,
      organisationId: ctx.organisationId,
    });
    await logActivity(db, clientActor(ctx), {
      organisationId: ctx.organisationId,
      action: "service.requested",
      summary: `${ctx.user.name} asked about ${service.name}`,
    });
    refresh();
    return {
      ok: true,
      message: `Thanks. We'll be in touch about ${service.name}. Nothing changes on your account until you agree to it.`,
    };
  }, fd);
}

export async function portalAskAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient();
    const question = String(fd.get("question") ?? "").trim();
    if (question.length < 3) return { ok: false, fieldErrors: { question: ["Ask a question."] } };
    const db = await getDb();
    await enforceRateLimit(db, `ask:${ctx.user.id}`, 40, 3600);
    const answer = await askMeaCreo(db, ctx.organisationId, question);
    return { ok: true, data: { question, ...answer } };
  }, fd);
}

export async function portalInviteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.members");
    const parsed = parseForm(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.email(),
        role: z.enum(["client_admin", "client_member"]),
      }),
      fd,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    await enforceRateLimit(db, `portal-invite:${ctx.user.id}`, 10, 3600);
    const { setupUrl } = await inviteClientUser(db, {
      organisationId: ctx.organisationId,
      ...parsed.data,
      invitedById: ctx.user.id,
    });
    await sendEmail(db, {
      to: { email: parsed.data.email, name: parsed.data.name },
      template: "invitation",
      category: "transactional",
      organisationId: ctx.organisationId,
      email: emailTemplates.invitation({
        name: parsed.data.name,
        inviter: ctx.user.name,
        organisation: ctx.organisationName,
        url: setupUrl ?? absoluteUrl("/login"),
      }),
    });
    await logActivity(db, clientActor(ctx), {
      organisationId: ctx.organisationId,
      action: "user.invited",
      summary: `${ctx.user.name} invited ${parsed.data.email}`,
    });
    refresh();
    return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
  }, fd);
}

export async function portalLogoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.members");
    const file = fd.get("logo");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, fieldErrors: { logo: ["Choose your logo file."] } };
    await setClientLogo(await getDb(), ctx.organisationId, file, {
      type: "client",
      id: ctx.user.id,
      label: ctx.user.name,
      userId: ctx.user.id,
    });
    refresh();
    return { ok: true, message: "Logo updated. It now appears on your reports and documents." };
  }, fd);
}

/** The client tracks what happened with a delivered prospect. */
export async function portalProspectStatusAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await requireClient("portal.access");
    const parsed = parseForm(prospectStatusSchema, fd);
    if (!parsed.success) return parsed.state;
    await setProspectStatus(
      await getDb(),
      ctx.organisationId,
      parsed.data.id,
      parsed.data.status,
      parsed.data.note,
    );
    refresh();
    return { ok: true, message: "Saved." };
  }, fd);
}
