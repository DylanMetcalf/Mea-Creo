import pino from "pino";

/**
 * Structured JSON logger. Secrets are redacted by path so that accidental
 * logging of a provider payload or request headers does not leak credentials.
 */
export const REDACT_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "apiKey",
  "*.apiKey",
  "secret",
  "*.secret",
  "passphrase",
  "*.passphrase",
  "authorization",
  "*.authorization",
  "headers.authorization",
  "headers.cookie",
  "*.headers.authorization",
  "*.headers.cookie",
];

export function createLogger(options: { level?: string; pretty?: boolean } = {}) {
  return pino({
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: "mea-creo", env: process.env.APP_ENV ?? "development" },
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export const logger = createLogger();

export type Logger = typeof logger;
