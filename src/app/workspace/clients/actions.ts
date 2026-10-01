"use server";

import { and, eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  clientAssignments,
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  competitors,
  contacts,
  FACT_CATEGORIES,
  messages,
  notes,
  opportunities,
  organisations,
  services,
  timelineEntries,
} from "@/db/schema";
import { kickJobs } from "@/jobs/kick";
import { type ActionState, optionalText, parseForm, runAction } from "@/lib/actions";
import { AppError } from "@/lib/errors";
import { absoluteUrl } from "@/lib/urls";
import { logActivity, userActor } from "@/modules/activity/log";
import { assertStaffClientAccess, requireStaff, type StaffContext } from "@/modules/auth/context";
import type { Permission } from "@/modules/auth/permissions";
import { recomputeHealth } from "@/modules/clients/health";
import { archiveDocument, uploadDocument } from "@/modules/documents/service";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { notifyClient } from "@/modules/notifications/service";
import {
  createClientOrganisation,
  inviteClientUser,
  setChecklistItem,
} from "@/modules/onboarding/service";
import { createRun } from "@/modules/runs/engine";
import {
  activateClientService,
  deactivateClientService,
  refreshMonthlyValue,
  setServicePaused,
} from "@/modules/services/activation";

async function staffFor(organisationId: string, permission: Permission): Promise<StaffContext> {
  const ctx = await requireStaff(permission);
  await assertStaffClientAccess(ctx, organisationId);
  return ctx;
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the company name.").max(160),
  website: optionalText(300),
  industry: optionalText(120),
  location: optionalText(120),
  country: z.string().trim().length(2).default("ZA"),
  currency: z.string().trim().length(3).default("ZAR"),
  employeeRange: optionalText(20),
  description: optionalText(2000),
  contactName: optionalText(120),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  contactRole: optionalText(120),
});

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id: string | null = null;
  const state = await runAction(async () => {
    const ctx = await requireStaff("clients.write");
    const parsed = parseForm(clientSchema, formData);
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const d = parsed.data;
    id = await createClientOrganisation(db, {
      name: d.name,
      website: d.website
        ? /^https?:\/\//.test(d.website)
          ? d.website
          : `https://${d.website}`
        : null,
      industry: d.industry,
      location: d.location,
      country: d.country,
      currency: d.currency,
      employeeRange: d.employeeRange,
      description: d.description,
      accountManagerId: ctx.user.id,
    });
    await db
      .insert(clientAssignments)
      .values({ organisationId: id, userId: ctx.user.id, responsibility: "account_manager" });
    if (d.contactName)
      await db
        .insert(contacts)
        .values({
          organisationId: id,
          name: d.contactName,
          email: d.contactEmail || null,
          role: d.contactRole,
          isPrimary: true,
        });
    await logActivity(db, userActor(ctx.user), {
      organisationId: id,
      action: "client.created",
      summary: `Created client ${d.name}`,
    });
  }, formData);
  if (id) redirect(`/workspace/clients/${id}`);
  return state;
}

export async function updateClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      clientSchema.extend({
        targetMarket: optionalText(1000),
        brandVoice: optionalText(1000),
        linkedinUrl: optionalText(300),
        phone: optionalText(40),
        email: z.union([z.email(), z.literal("")]).optional(),
        renewalDate: optionalText(10),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const [before] = await db
      .select()
      .from(clients)
      .where(eq(clients.organisationId, organisationId));
    const d = parsed.data;
    const after = {
      name: d.name,
      website: d.website ?? null,
      industry: d.industry ?? null,
      location: d.location ?? null,
      country: d.country,
      currency: d.currency,
      employeeRange: d.employeeRange ?? null,
      description: d.description ?? null,
      targetMarket: d.targetMarket ?? null,
      brandVoice: d.brandVoice ?? null,
      linkedinUrl: d.linkedinUrl ?? null,
      phone: d.phone ?? null,
      email: d.email || null,
      renewalDate: d.renewalDate ?? null,
    };
    await db.update(clients).set(after).where(eq(clients.organisationId, organisationId));
    await db
      .update(organisations)
      .set({ name: d.name })
      .where(eq(organisations.id, organisationId));
    await logActivity(db, userActor(ctx.user), {
      organisationId,
      action: "client.updated",
      summary: "Updated client profile",
      before: { name: before?.name, website: before?.website, industry: before?.industry },
      after: { name: after.name, website: after.website, industry: after.industry },
    });
    refresh();
    return { ok: true, message: "Profile saved." };
  }, formData);
}

export async function addFactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        category: z.enum(FACT_CATEGORIES),
        label: z.string().trim().min(2).max(120),
        value: z.string().trim().min(2).max(2000),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    await db
      .insert(clientBrainFacts)
      .values({
        organisationId,
        ...parsed.data,
        sourceType: "human",
        verification: "verified",
        createdById: ctx.user.id,
      });
    await logActivity(db, userActor(ctx.user), {
      organisationId,
      action: "brain.fact_added",
      summary: `Added fact: ${parsed.data.label}`,
    });
    refresh();
    return { ok: true, message: "Added to the Client Brain." };
  }, formData);
}

export async function factVerificationAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "clients.write");
  const db = await getDb();
  const id = str(formData, "factId");
  const decision = str(formData, "decision");
  if (decision === "delete")
    await db
      .delete(clientBrainFacts)
      .where(and(eq(clientBrainFacts.id, id), eq(clientBrainFacts.organisationId, organisationId)));
  else
    await db
      .update(clientBrainFacts)
      .set({ verification: decision === "verify" ? "verified" : "rejected" })
      .where(and(eq(clientBrainFacts.id, id), eq(clientBrainFacts.organisationId, organisationId)));
  await logActivity(db, userActor(ctx.user), {
    organisationId,
    action: `brain.fact_${decision}`,
    summary: `Client Brain fact ${decision === "verify" ? "verified" : decision === "delete" ? "deleted" : "rejected"}`,
    entityType: "brain_fact",
    entityId: id,
  });
  refresh();
}

export async function addGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        title: z.string().trim().min(3).max(200),
        kpi: optionalText(200),
        baseline: optionalText(100),
        target: optionalText(100),
        current: optionalText(100),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    await (await getDb()).insert(clientGoals).values({ organisationId, ...parsed.data });
    refresh();
    return { ok: true, message: "Goal added." };
  }, formData);
}

export async function updateGoalAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  await staffFor(organisationId, "clients.write");
  const status = str(formData, "status") as "active" | "achieved" | "paused" | "dropped";
  const current = str(formData, "current");
  await (
    await getDb()
  )
    .update(clientGoals)
    .set({ ...(status ? { status } : {}), ...(current ? { current } : {}) })
    .where(
      and(
        eq(clientGoals.id, str(formData, "goalId")),
        eq(clientGoals.organisationId, organisationId),
      ),
    );
  refresh();
}

export async function addCompetitorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        name: z.string().trim().min(2).max(120),
        website: optionalText(300),
        notes: optionalText(500),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    const website =
      parsed.data.website && !/^https?:\/\//.test(parsed.data.website)
        ? `https://${parsed.data.website}`
        : parsed.data.website;
    await (await getDb()).insert(competitors).values({ organisationId, ...parsed.data, website });
    refresh();
    return { ok: true, message: "Competitor added." };
  }, formData);
}

export async function removeCompetitorAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  await staffFor(organisationId, "clients.write");
  await (
    await getDb()
  )
    .delete(competitors)
    .where(
      and(
        eq(competitors.id, str(formData, "competitorId")),
        eq(competitors.organisationId, organisationId),
      ),
    );
  refresh();
}

export async function addContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.union([z.email(), z.literal("")]).optional(),
        phone: optionalText(40),
        role: optionalText(120),
        isDecisionMaker: z.string().optional(),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    await (
      await getDb()
    )
      .insert(contacts)
      .values({
        organisationId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone,
        role: parsed.data.role,
        isDecisionMaker: parsed.data.isDecisionMaker === "on",
      });
    refresh();
    return { ok: true, message: "Contact added." };
  }, formData);
}

export async function addClientServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "services.manage");
    const db = await getDb();
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, str(formData, "serviceId")));
    const [client] = await db
      .select({ currency: clients.currency })
      .from(clients)
      .where(eq(clients.organisationId, organisationId));
    if (!service || !client) throw new AppError("NOT_FOUND");
    const price = service.prices[client.currency] ?? {};
    const monthly = Math.round(
      Number(str(formData, "monthly") || (price.monthlyMinor ?? 0) / 100) * 100,
    );
    const setup = Math.round(
      Number(str(formData, "setup") || ((price.setupMinor ?? 0) + (price.oneOffMinor ?? 0)) / 100) *
        100,
    );
    const [cs] = await db
      .insert(clientServices)
      .values({
        organisationId,
        serviceId: service.id,
        status: "pending",
        currency: client.currency,
        monthlyMinor: service.billingType === "monthly" ? monthly : 0,
        setupMinor: setup,
      })
      .returning({ id: clientServices.id });
    if (str(formData, "activate") === "on")
      await activateClientService(db, cs.id, userActor(ctx.user));
    await refreshMonthlyValue(db, organisationId);
    await logActivity(db, userActor(ctx.user), {
      organisationId,
      action: "service.added",
      summary: `Added ${service.name}`,
    });
    refresh();
    return { ok: true, message: `${service.name} added.` };
  }, formData);
}

export async function clientServiceStateAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "services.manage");
  const db = await getDb();
  const id = str(formData, "clientServiceId");
  const [cs] = await db
    .select()
    .from(clientServices)
    .where(and(eq(clientServices.id, id), eq(clientServices.organisationId, organisationId)));
  if (!cs) throw new AppError("NOT_FOUND");
  const op = str(formData, "op");
  const actor = userActor(ctx.user);
  if (op === "activate") await activateClientService(db, id, actor);
  else if (op === "pause") await setServicePaused(db, id, true, actor);
  else if (op === "resume") await setServicePaused(db, id, false, actor);
  else if (op === "cancel") await deactivateClientService(db, id, actor, "Ended by Mea Creo");
  await refreshMonthlyValue(db, organisationId);
  await recomputeHealth(db, organisationId);
  refresh();
}

export async function updateServiceFocusAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  await staffFor(organisationId, "clients.write");
  await (
    await getDb()
  )
    .update(clientServices)
    .set({ currentFocus: str(formData, "currentFocus").slice(0, 500) || null })
    .where(
      and(
        eq(clientServices.id, str(formData, "clientServiceId")),
        eq(clientServices.organisationId, organisationId),
      ),
    );
  refresh();
}

export async function runClientAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "runs.execute");
  const db = await getDb();
  const runId = await createRun(db, {
    organisationId,
    kind: str(formData, "kind"),
    triggeredById: ctx.user.id,
  });
  kickJobs();
  redirect(`/workspace/runs/${runId}`);
}

export async function refreshHealthAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  await staffFor(organisationId, "clients.read.assigned");
  await recomputeHealth(await getDb(), organisationId);
  refresh();
}

export async function opportunityAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "clients.write");
  const db = await getDb();
  const id = str(formData, "opportunityId");
  const op = str(formData, "op");
  if (op === "share" || op === "unshare") {
    await db
      .update(opportunities)
      .set({ clientVisible: op === "share" ? "yes" : "no" })
      .where(and(eq(opportunities.id, id), eq(opportunities.organisationId, organisationId)));
  } else {
    await db
      .update(opportunities)
      .set({ status: op === "accept" ? "accepted" : "dismissed" })
      .where(and(eq(opportunities.id, id), eq(opportunities.organisationId, organisationId)));
  }
  await logActivity(db, userActor(ctx.user), {
    organisationId,
    action: `opportunity.${op}`,
    summary: `Opportunity ${op}`,
    entityType: "opportunity",
    entityId: id,
  });
  refresh();
}

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.email(),
        role: z.enum(["client_admin", "client_member"]),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    const db = await getDb();
    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, organisationId));
    const { setupUrl } = await inviteClientUser(db, {
      organisationId,
      ...parsed.data,
      invitedById: ctx.user.id,
    });
    await sendEmail(db, {
      to: { email: parsed.data.email, name: parsed.data.name },
      template: "invitation",
      category: "transactional",
      organisationId,
      email: emailTemplates.invitation({
        name: parsed.data.name,
        inviter: ctx.user.name,
        organisation: org?.name ?? "your",
        url: setupUrl ?? absoluteUrl("/login"),
      }),
    });
    await logActivity(db, userActor(ctx.user), {
      organisationId,
      action: "user.invited",
      summary: `Invited ${parsed.data.email} to the portal`,
    });
    refresh();
    return {
      ok: true,
      message: setupUrl
        ? `Invitation sent to ${parsed.data.email}.`
        : `${parsed.data.email} already had an account and now has access.`,
    };
  }, formData);
}

export async function automationPauseAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "clients.write");
  const paused = str(formData, "paused") === "true";
  const db = await getDb();
  await db
    .update(clients)
    .set({ automationPaused: paused })
    .where(eq(clients.organisationId, organisationId));
  await logActivity(db, userActor(ctx.user), {
    organisationId,
    action: paused ? "automation.paused" : "automation.resumed",
    summary: `Automation ${paused ? "paused" : "resumed"} for this client`,
  });
  refresh();
}

export async function checklistAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  await staffFor(organisationId, "clients.write");
  await setChecklistItem(
    await getDb(),
    organisationId,
    str(formData, "key"),
    str(formData, "done") === "true",
  );
  refresh();
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "clients.read.assigned");
    const body = str(formData, "body").trim();
    if (body.length < 2) return { ok: false, fieldErrors: { body: ["Write a note first."] } };
    await (
      await getDb()
    )
      .insert(notes)
      .values({
        organisationId,
        entityType: "client",
        entityId: organisationId,
        body: body.slice(0, 5000),
        authorId: ctx.user.id,
        visibility: "internal",
      });
    refresh();
    return { ok: true };
  }, formData);
}

export async function addTimelineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    await staffFor(organisationId, "clients.write");
    const parsed = parseForm(
      z.object({
        title: z.string().trim().min(3).max(200),
        description: optionalText(1000),
        kind: z.enum(["milestone", "work", "result", "opportunity"]),
      }),
      formData,
    );
    if (!parsed.success) return parsed.state;
    await (
      await getDb()
    )
      .insert(timelineEntries)
      .values({ organisationId, ...parsed.data, visibility: "client" });
    refresh();
    return { ok: true, message: "Added to the growth timeline." };
  }, formData);
}

export async function sendMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "clients.read.assigned");
    const body = str(formData, "body").trim();
    if (!body) return { ok: false, fieldErrors: { body: ["Write a message first."] } };
    const db = await getDb();
    await db
      .insert(messages)
      .values({
        organisationId,
        authorId: ctx.user.id,
        fromClient: false,
        body: body.slice(0, 5000),
        readByStaffAt: new Date(),
      });
    await db
      .update(messages)
      .set({ readByStaffAt: new Date() })
      .where(and(eq(messages.organisationId, organisationId), eq(messages.fromClient, true)));
    await notifyClient(db, organisationId, {
      kind: "message",
      title: `New message from ${ctx.user.name}`,
      body: body.slice(0, 140),
      link: "/portal/messages",
    });
    refresh();
    return { ok: true };
  }, formData);
}

export async function uploadDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const organisationId = str(formData, "organisationId");
    const ctx = await staffFor(organisationId, "documents.write");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, fieldErrors: { file: ["Choose a file to upload."] } };
    await uploadDocument(await getDb(), {
      organisationId,
      file,
      category: str(formData, "category") || "auto",
      visibility: str(formData, "visibility") === "internal" ? "internal" : "client",
      actor: userActor(ctx.user),
      uploadedById: ctx.user.id,
      byClient: false,
      description: str(formData, "description") || undefined,
    });
    refresh();
    return { ok: true, message: `${file.name} uploaded.` };
  }, formData);
}

export async function archiveDocumentAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "documents.write");
  await archiveDocument(
    await getDb(),
    str(formData, "documentId"),
    organisationId,
    userActor(ctx.user),
  );
  refresh();
}

export async function archiveClientAction(formData: FormData): Promise<void> {
  const organisationId = str(formData, "organisationId");
  const ctx = await staffFor(organisationId, "clients.delete");
  const db = await getDb();
  await db
    .update(organisations)
    .set({ archivedAt: new Date() })
    .where(eq(organisations.id, organisationId));
  await db
    .update(clients)
    .set({ lifecycle: "offboarded", billingState: "archived" })
    .where(eq(clients.organisationId, organisationId));
  await db
    .update(clientServices)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(clientServices.organisationId, organisationId));
  await logActivity(db, userActor(ctx.user), {
    organisationId,
    action: "client.archived",
    summary: "Client archived (data preserved)",
  });
  revalidatePath("/workspace/clients");
  redirect("/workspace/clients");
}
