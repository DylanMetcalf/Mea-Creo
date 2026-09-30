import { bigint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "@/lib/ids";

/** Primary key: UUIDv7 generated in the application. */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });

/** Integer minor units (cents). Always paired with a `currency` column. */
export const moneyMinor = (name: string) => bigint(name, { mode: "number" });

export const currency = (name = "currency") => text(name).notNull().default("ZAR");

export const VISIBILITIES = ["internal", "client"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Whether a record may be shown in the client portal. Internal by default. */
export const visibility = () =>
  text("visibility", { enum: VISIBILITIES }).notNull().default("internal");
