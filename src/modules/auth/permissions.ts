/**
 * Role-based permissions. Code checks permissions, never role names, so roles
 * can be re-shaped without touching business logic.
 *
 * Staff roles belong to the Mea Creo (platform) organisation. Client roles belong
 * to a client organisation and only ever see that organisation's portal.
 * AI agents are not users: they act under an explicit, scoped permission set
 * (see src/agents/registry.ts).
 */

export const STAFF_ROLES = [
  "founder",
  "manager",
  "specialist",
  "creative",
  "sales",
  "viewer",
] as const;
export const CLIENT_ROLES = ["client_admin", "client_member"] as const;
export const ROLES = [...STAFF_ROLES, ...CLIENT_ROLES] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  founder: "Founder",
  manager: "Manager",
  specialist: "Specialist",
  creative: "Creative",
  sales: "Sales",
  viewer: "Read only",
  client_admin: "Client admin",
  client_member: "Client member",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  founder: "Full access to everything, including billing, settings and users.",
  manager: "Manages clients, team work, proposals and approvals. No system settings.",
  specialist: "Works on assigned clients and their services.",
  creative: "Creative and content work on assigned clients.",
  sales: "Leads, prospects, audits, meetings and proposals.",
  viewer: "Can view the workspace but not change anything.",
  client_admin: "Client portal access, including billing and inviting colleagues.",
  client_member: "Client portal access without billing or user management.",
};

export const PERMISSIONS = [
  "workspace.access",
  "dashboard.business",
  "clients.read.all",
  "clients.read.assigned",
  "clients.write",
  "clients.delete",
  "leads.read",
  "leads.write",
  "audits.run",
  "meetings.write",
  "proposals.write",
  "proposals.send",
  "tasks.write",
  "documents.write",
  "content.write",
  "reports.write",
  "reports.publish",
  "approvals.decide",
  "runs.execute",
  "services.manage",
  "billing.read",
  "billing.manage",
  "users.manage",
  "settings.manage",
  "integrations.manage",
  "agents.manage",
  "emergency.controls",
  "data.export",
  // Client portal
  "portal.access",
  "portal.billing",
  "portal.approve",
  "portal.upload",
  "portal.members",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF_BASE: Permission[] = ["workspace.access"];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  founder: PERMISSIONS.filter((p) => !p.startsWith("portal.")),
  manager: [
    ...STAFF_BASE,
    "dashboard.business",
    "clients.read.all",
    "clients.write",
    "leads.read",
    "leads.write",
    "audits.run",
    "meetings.write",
    "proposals.write",
    "proposals.send",
    "tasks.write",
    "documents.write",
    "content.write",
    "reports.write",
    "reports.publish",
    "approvals.decide",
    "runs.execute",
    "services.manage",
    "billing.read",
    "data.export",
  ],
  specialist: [
    ...STAFF_BASE,
    "clients.read.assigned",
    "audits.run",
    "tasks.write",
    "documents.write",
    "content.write",
    "reports.write",
    "runs.execute",
  ],
  creative: [
    ...STAFF_BASE,
    "clients.read.assigned",
    "tasks.write",
    "documents.write",
    "content.write",
  ],
  sales: [
    ...STAFF_BASE,
    "leads.read",
    "leads.write",
    "audits.run",
    "meetings.write",
    "proposals.write",
    "clients.read.assigned",
  ],
  viewer: [...STAFF_BASE, "clients.read.all", "leads.read"],
  client_admin: [
    "portal.access",
    "portal.billing",
    "portal.approve",
    "portal.upload",
    "portal.members",
  ],
  client_member: ["portal.access", "portal.approve", "portal.upload"],
};

export function isStaffRole(role: Role): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

export function roleHas(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
