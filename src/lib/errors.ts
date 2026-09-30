/**
 * Application errors carry two messages: an internal one for logs and a
 * human-readable one that is safe to show to any user. Stack traces and
 * internal messages are never returned to the browser.
 */

export const ERROR_CODES = {
  VALIDATION: { status: 400, message: "Some of the information provided isn't valid." },
  UNAUTHENTICATED: { status: 401, message: "Please sign in to continue." },
  FORBIDDEN: { status: 403, message: "You don't have access to this." },
  NOT_FOUND: { status: 404, message: "We couldn't find what you were looking for." },
  CONFLICT: { status: 409, message: "This was changed by someone else. Refresh and try again." },
  RATE_LIMITED: { status: 429, message: "Too many requests. Please wait a moment and try again." },
  INTEGRATION_NOT_CONNECTED: {
    status: 409,
    message: "This integration is not connected yet.",
  },
  INTEGRATION_FAILED: {
    status: 502,
    message: "A connected service didn't respond as expected. Please try again shortly.",
  },
  BUDGET_EXCEEDED: { status: 429, message: "The configured usage budget has been reached." },
  INTERNAL: {
    status: 500,
    message:
      "Something went wrong on our side. Please try again, or contact us if it keeps happening.",
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      userMessage?: string;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? ERROR_CODES[code].message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.userMessage = options.userMessage ?? ERROR_CODES[code].message;
    this.retryable =
      options.retryable ?? (code === "INTEGRATION_FAILED" || code === "RATE_LIMITED");
    this.details = options.details;
  }
}

export interface PublicError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

/** Converts any thrown value into a shape that is safe to send to a client. */
export function toPublicError(error: unknown): PublicError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.userMessage, retryable: error.retryable };
  }
  return { code: "INTERNAL", message: ERROR_CODES.INTERNAL.message, retryable: true };
}

export function statusOf(error: unknown): number {
  return error instanceof AppError ? error.status : 500;
}
