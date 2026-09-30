import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLES } from "@/modules/auth/permissions";
import { createdAt, id, timestamps } from "./_common";

export const ORGANISATION_KINDS = ["platform", "client"] as const;
export type OrganisationKind = (typeof ORGANISATION_KINDS)[number];

/**
 * Tenants. Exactly one `platform` organisation (Mea Creo) whose members are staff.
 * Every client — including Mea Creo's own "internal client" — is a `client` organisation.
 */
export const organisations = pgTable("organisations", {
  id: id(),
  kind: text("kind", { enum: ORGANISATION_KINDS }).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isDemo: boolean("is_demo").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...timestamps(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** scrypt hash (see src/modules/auth/password.ts). Null for OAuth-only or invited users. */
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  googleSubject: text("google_subject").unique(),
  phone: text("phone"),
  title: text("title"),
  isDemo: boolean("is_demo").notNull().default(false),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("memberships_user_org_uq").on(t.userId, t.organisationId),
    index("memberships_org_idx").on(t.organisationId),
  ],
);

/** Server-side sessions. Only a SHA-256 hash of the cookie token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Active client organisation for users with portal access to more than one. */
    activeOrganisationId: uuid("active_organisation_id"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const TOKEN_PURPOSES = ["password_reset", "invitation", "email_verification"] as const;

/** Single-use tokens (hash stored, never the token). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    purpose: text("purpose", { enum: TOKEN_PURPOSES }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    role: text("role", { enum: ROLES }),
    invitedById: uuid("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_email_idx").on(t.email)],
);

export const CLIENT_RESPONSIBILITIES = [
  "account_manager",
  "seo",
  "growth",
  "creative",
  "automation",
  "sales",
] as const;
export type ClientResponsibility = (typeof CLIENT_RESPONSIBILITIES)[number];

/** Which staff member looks after which part of a client. Drives assigned-client access. */
export const clientAssignments = pgTable(
  "client_assignments",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    responsibility: text("responsibility", { enum: CLIENT_RESPONSIBILITIES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("client_assignments_uq").on(t.organisationId, t.userId, t.responsibility),
    index("client_assignments_user_idx").on(t.userId),
  ],
);

/** API keys for machine integrations (Founder OS, Sales Scout). Hash stored only. */
export const apiKeys = pgTable("api_keys", {
  id: id(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Fixed-window rate limiter backed by Postgres (no Redis needed at this scale). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
