import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ActionForm,
  FileDropField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/ui/form";
import { ClientLogo } from "@/components/workspace/client-logo";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { getDb } from "@/db";
import { clients, memberships, users } from "@/db/schema";
import { requireClient } from "@/modules/auth/context";
import { ROLE_LABELS, type Role } from "@/modules/auth/permissions";
import { portalInviteAction, portalLogoAction } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default async function PortalSettings() {
  const ctx = await requireClient();
  const db = await getDb();
  const [client] = await db
    .select({ logo: clients.logoDocumentId, name: clients.name })
    .from(clients)
    .where(eq(clients.organisationId, ctx.organisationId));
  const team = await db
    .select({ id: users.id, name: users.name, email: users.email, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organisationId, ctx.organisationId));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-ink text-3xl">Account & team</h1>
      <Card>
        <CardHeader
          title="Your logo"
          description="Shown on your reports, proposals and documents, and in your workspace."
        />
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <ClientLogo
            organisationId={ctx.organisationId}
            name={client?.name ?? ctx.organisationName}
            hasLogo={Boolean(client?.logo)}
            size="lg"
          />
          {ctx.can("portal.members") ? (
            <ActionForm action={portalLogoAction} className="min-w-0 flex-1 space-y-3">
              <FileDropField
                name="logo"
                label={client?.logo ? "Replace logo" : "Upload logo"}
                hint="PNG, JPG or WebP. A transparent PNG works best."
                accept="image/png,image/jpeg,image/webp"
              />
              <SubmitButton size="sm">Save logo</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-muted text-sm">Ask an account admin to change the logo.</p>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="You" />
        <CardBody>
          <DescriptionList
            items={[
              ["Name", ctx.user.name],
              ["Email", ctx.user.email],
              ["Role", ROLE_LABELS[ctx.role]],
              ["Organisation", ctx.organisationName],
            ]}
          />
          <p className="mt-4 text-sm">
            <Link href="/forgot-password" className="text-brand-700 underline">
              Change your password
            </Link>
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Your team"
          description="People from your organisation who can use this portal."
        />
        <ul className="divide-border divide-y">
          {team.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span>
                {m.name}
                <span className="text-muted block text-xs">{m.email}</span>
              </span>
              <span className="text-muted text-xs">{ROLE_LABELS[m.role as Role]}</span>
            </li>
          ))}
        </ul>
        {ctx.can("portal.members") && (
          <CardBody className="border-border border-t">
            <ActionForm
              action={portalInviteAction}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              resetOnSuccess
            >
              <TextField name="name" label="Name" required />
              <TextField name="email" type="email" label="Email" required />
              <SelectField
                name="role"
                label="Access"
                options={[
                  { value: "client_member", label: "Team member (no billing)" },
                  { value: "client_admin", label: "Admin (billing and team)" },
                ]}
              />
              <div className="flex items-end">
                <SubmitButton>Invite</SubmitButton>
              </div>
            </ActionForm>
          </CardBody>
        )}
      </Card>
      <p className="text-muted text-sm">
        Need your data exported or deleted?{" "}
        <Link href="/portal/messages" className="text-brand-700 underline">
          Send us a message
        </Link>{" "}
        and we&apos;ll handle it under POPIA.
      </p>
    </div>
  );
}
