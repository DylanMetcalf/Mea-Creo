import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AppError, toPublicError } from "./errors";
import { logger } from "./logger";

/** Result of a form Server Action, consumed by <ActionForm> via useActionState. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Echo of submitted values so fields keep their content after a validation error. */
  values?: Record<string, string>;
  /** Optional data returned to the client, e.g. a created id. */
  data?: Record<string, unknown>;
} | null;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

/** Parses FormData with a zod schema, or returns field errors. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData | Record<string, unknown>,
): { success: true; data: z.infer<T> } | { success: false; state: ActionState } {
  const raw = formData instanceof FormData ? formValues(formData) : formData;
  const result = schema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    success: false,
    state: {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors,
      values: formData instanceof FormData ? formValues(formData) : undefined,
    },
  };
}

/**
 * Wraps a Server Action body so every failure becomes a human-readable ActionState.
 * Framework control flow (redirect, notFound, forbidden) is re-thrown untouched.
 */
export async function runAction(
  fn: () => Promise<ActionState | void>,
  formData?: FormData,
): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof AppError))
      logger.error(
        { err: error instanceof Error ? { message: error.message, stack: error.stack } : error },
        "action failed",
      );
    const publicError = toPublicError(error);
    return {
      ok: false,
      message: publicError.message,
      values: formData ? formValues(formData) : undefined,
    };
  }
}

/** Optional string field: empty input becomes undefined. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");
