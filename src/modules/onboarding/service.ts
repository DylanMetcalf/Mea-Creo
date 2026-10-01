import type { Role } from "@/modules/auth/permissions";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  clientBrainFacts,
  clientGoals,
  clients,
  clientServices,
  contacts,
  leads,
  memberships,
  organisations,
  projects,
  proposalItems,
  proposals,
  tasks,
  timelineEntries,
  users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/ids";
import { absoluteUrl } from "@/lib/urls";
import { queueClientAudit } from "@/modules/audits/service";
import { createAuthToken } from "@/modules/auth/tokens";
import { createInvoice } from "@/modules/billing/service";
import { sendEmail } from "@/modules/email/service";
import { emailTemplates } from "@/modules/email/templates";
import { emitEvent } from "@/modules/notifications/service";

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  owner: "client" | "mea_creo";
};

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: "company", label: "Confirm company details", done: false, owner: "client" },
  { key: "contacts", label: "Add contacts and decision makers", done: false, owner: "client" },
  { key: "website_access", label: "Share website/CMS access", done: false, owner: "client" },
  { key: "goals", label: "Agree goals and KPIs", done: false, owner: "mea_creo" },
  { key: "competitors", label: "List 2–3 competitors", done: false, owner: "client" },
  { key: "brand", label: "Upload logo and brand guidelines", done: false, owner: "client" },
  {
    key: "integrations",
    label: "Connect Google Search Console and Analytics",
    done: false,
    owner: "client",
  },
  { key: "approvals", label: "Set approval preferences", done: false, owner: "client" },
  { key: "billing", label: "Pay setup invoice", done: false, owner: "client" },
  { key: "kickoff", label: "Hold onboarding session", done: false, owner: "mea_creo" },
  { key: "strategy", label: "Present first strategy", done: false, owner: "mea_creo" },
  { key: "start", label: "Start services", done: false, owner: "mea_creo" },
];

async function uniqueSlug(db: DbOrTx, name: string): Promise<string> {
  const base = slugify(name) || "client";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [exists] = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.slug, candidate))
      .limit(1);
    if (!exists) return candidate;
  }
}

/** Creates a client organisation with its profile and checklist. Used by onboarding and "Add client". */
export async function createClientOrganisation(
  db: DbOrTx,
  input: {
    name: string;
    website?: string | null;
    industry?: string | null;
    location?: string | null;
    country?: string;
    currency?: string;
    accountManagerId?: string | null;
    employeeRange?: string | null;
    description?: string | null;
    isDemo?: boolean;
  },
): Promise<string> {
  const [org] = await db
    .insert(organisations)
    .values({
      kind: "client",
      name: input.name,
      slug: await uniqueSlug(db, input.name),
      isDemo: input.isDemo ?? false,
    })
    .returning({ id: organisations.id });
  await db.insert(clients).values({
    organisationId: org.id,
    name: input.name,
    website: input.website,
    industry: input.industry,
    location: input.location,
    country: input.country ?? "ZA",
    currency: input.currency ?? "ZAR",
    accountManagerId: input.accountManagerId,
    employeeRange: input.employeeRange,
    description: input.description,
    lifecycle: "onboarding",
    billingState: "pending_payment",
    onboardingChecklist: DEFAULT_CHECKLIST,
  });
  await emitEvent(db, "client.created", org.id, {});
  return org.id;
}

/** Ensures a portal user exists and has access; returns a set-password link for new users. */
export async function inviteClientUser(
  db: DbOrTx,
  input: {
    organisationId: string;
    email: string;
    name: string;
    role: Role;
    invitedById?: string;
  },
): Promise<{ userId: string; setupUrl: string | null }> {
  const email = input.email.toLowerCase();
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) [user] = await db.insert(users).values({ email, name: input.name }).returning();
  const [existing] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(5);
  if (!existing || existing.organisationId !== input.organisationId) {
    await db
      .insert(memberships)
      .values({ userId: user.id, organisationId: input.organisationId, role: input.role })
      .onConflictDoNothing();
  }
  if (user.passwordHash) return { userId: user.id, setupUrl: null };
  const token = await createAuthToken(db, {
    purpose: "invitation",
    email,
    userId: user.id,
    organisationId: input.organisationId,
    role: input.role,
    invitedById: input.invitedById,
    ttlHours: 24 * 7,
  });
  return { userId: user.id, setupUrl: absoluteUrl(`/invite/${token}`) };
}

/** Everything that happens when a proposal is accepted. Runs inside the acceptance transaction. */
export async function onboardFromProposal(
  db: DbOrTx,
  proposalId: string,
  signer: { name: string; email: string; role?: string },
): Promise<{ organisationId: string; invoiceId: string | null }> {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) throw new AppError("NOT_FOUND");
  const items = await db
    .select()
    .from(proposalItems)
    .where(eq(proposalItems.proposalId, proposalId));
  const [lead] = proposal.leadId
    ? await db.select().from(leads).where(eq(leads.id, proposal.leadId)).limit(1)
    : [];

  const organisationId = await createClientOrganisation(db, {
    name: proposal.companyName,
    website: lead?.website,
    industry: lead?.industry,
    location: lead?.location,
    employeeRange: lead?.employeeRange,
    currency: proposal.currency,
    accountManagerId: proposal.createdById,
  });
  const start = new Date();
  const renewal = new Date(start);
  renewal.setMonth(renewal.getMonth() + proposal.contractMonths);
  await db
    .update(clients)
    .set({
      startDate: start.toISOString().slice(0, 10),
      renewalDate: renewal.toISOString().slice(0, 10),
      email: signer.email,
    })
    .where(eq(clients.organisationId, organisationId));
  await db.update(proposals).set({ organisationId }).where(eq(proposals.id, proposalId));
  await db.insert(contacts).values({
    organisationId,
    name: signer.name,
    email: signer.email,
    role: signer.role,
    isPrimary: true,
    isDecisionMaker: true,
  });

  // Service plan (pending until the setup invoice is paid).
  const core = items.filter((i) => !i.optional && i.serviceId);
  const discount = proposal.discountPercent / 100;
  for (const item of core) {
    await db.insert(clientServices).values({
      organisationId,
      serviceId: item.serviceId!,
      status: "pending",
      currency: proposal.currency,
      monthlyMinor: Math.round(item.monthlyMinor * (1 - discount)),
      setupMinor: item.setupMinor + item.oneOffMinor,
    });
  }

  // Client Brain and goals from what was agreed.
  if (lead?.industry)
    await db.insert(clientBrainFacts).values({
      organisationId,
      category: "company",
      label: "Industry",
      value: lead.industry,
      sourceType: "human",
    });
  for (const problem of proposal.problems)
    await db.insert(clientBrainFacts).values({
      organisationId,
      category: "strategy",
      label: "Problem to solve",
      value: problem,
      sourceType: "human",
      sourceRef: `proposal:${proposal.number}`,
    });
  for (const goal of proposal.goals)
    await db.insert(clientGoals).values({ organisationId, title: goal });

  // Project, onboarding tasks, meeting schedule.
  const [project] = await db
    .insert(projects)
    .values({ organisationId, name: "Onboarding", description: `From proposal ${proposal.number}` })
    .returning({ id: projects.id });
  const day = (n: number) => new Date(Date.now() + n * 86400_000);
  await db.insert(tasks).values([
    {
      organisationId,
      projectId: project.id,
      title: "Welcome call: book the onboarding session",
      status: "ready",
      priority: "high",
      dueAt: day(2),
      source: "onboarding",
      visibility: "client",
      assigneeId: proposal.createdById,
    },
    {
      organisationId,
      projectId: project.id,
      title: "Review the initial visibility audit",
      status: "ready",
      dueAt: day(3),
      source: "onboarding",
      visibility: "internal",
      assigneeId: proposal.createdById,
    },
    {
      organisationId,
      projectId: project.id,
      title: "Request website and Search Console access",
      status: "waiting_client",
      dueAt: day(5),
      source: "onboarding",
      visibility: "client",
    },
    {
      organisationId,
      projectId: project.id,
      title: "Prepare first-month strategy",
      status: "backlog",
      dueAt: day(10),
      source: "onboarding",
      visibility: "client",
      assigneeId: proposal.createdById,
    },
    {
      organisationId,
      projectId: project.id,
      title: "Schedule monthly review meetings",
      status: "ready",
      dueAt: day(10),
      source: "onboarding",
      visibility: "internal",
      assigneeId: proposal.createdById,
    },
  ]);

  // Initial audit (runs in the background).
  if (lead?.website) await queueClientAudit(db, { organisationId, kind: "visibility" });

  // Billing record.
  const setupTotal = core.reduce((s, i) => s + i.setupMinor + i.oneOffMinor, 0);
  const monthlyTotal = core.reduce((s, i) => s + Math.round(i.monthlyMinor * (1 - discount)), 0);
  let invoiceId: string | null = null;
  if (setupTotal > 0 || monthlyTotal > 0) {
    const invoice = await createInvoice(db, {
      organisationId,
      kind: "setup",
      currency: proposal.currency,
      proposalId,
      description: `Proposal ${proposal.number}: setup${monthlyTotal ? " and first month" : ""}`,
      lines: [
        ...core
          .filter((i) => i.setupMinor + i.oneOffMinor > 0)
          .map((i) => ({
            description: `${i.name}: setup`,
            unitMinor: i.setupMinor + i.oneOffMinor,
          })),
        ...core
          .filter((i) => i.monthlyMinor > 0)
          .map((i) => ({
            description: `${i.name}: first month`,
            unitMinor: Math.round(i.monthlyMinor * (1 - discount)),
          })),
      ],
    });
    invoiceId = invoice.id;
  }

  // Portal account.
  const { setupUrl } = await inviteClientUser(db, {
    organisationId,
    email: signer.email,
    name: signer.name,
    role: "client_admin",
    invitedById: proposal.createdById ?? undefined,
  });
  await sendEmail(db, {
    to: { email: signer.email, name: signer.name },
    template: "welcome",
    category: "transactional",
    organisationId,
    email: emailTemplates.welcome({
      name: signer.name,
      company: proposal.companyName,
      url: setupUrl ?? absoluteUrl("/login"),
    }),
    idempotencyKey: `welcome:${organisationId}`,
  });

  if (lead)
    await db
      .update(leads)
      .set({
        stage: invoiceId ? "payment_pending" : "onboarding",
        clientOrganisationId: organisationId,
        lastActivityAt: new Date(),
      })
      .where(eq(leads.id, lead.id));
  await db.insert(timelineEntries).values({
    organisationId,
    kind: "onboarding",
    title: "Welcome to Mea Creo",
    description: `Proposal ${proposal.number} accepted by ${signer.name}.`,
    visibility: "client",
  });
  return { organisationId, invoiceId };
}

/** Marks a checklist item; completing all items moves the client to active. */
export async function setChecklistItem(
  db: DbOrTx,
  organisationId: string,
  key: string,
  done: boolean,
): Promise<void> {
  const [client] = await db
    .select({ checklist: clients.onboardingChecklist, lifecycle: clients.lifecycle })
    .from(clients)
    .where(eq(clients.organisationId, organisationId));
  if (!client) throw new AppError("NOT_FOUND");
  const checklist = client.checklist.map((item) => (item.key === key ? { ...item, done } : item));
  const complete = checklist.length > 0 && checklist.every((i) => i.done);
  await db
    .update(clients)
    .set({
      onboardingChecklist: checklist,
      lifecycle: complete && client.lifecycle === "onboarding" ? "active" : client.lifecycle,
    })
    .where(eq(clients.organisationId, organisationId));
  if (complete && client.lifecycle === "onboarding") {
    await db.insert(timelineEntries).values({
      organisationId,
      kind: "milestone",
      title: "Onboarding complete",
      visibility: "client",
    });
  }
}
