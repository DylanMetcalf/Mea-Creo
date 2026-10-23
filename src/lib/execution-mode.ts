import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped execution mode. In a dry run, code that would reach the outside world
 * (sending email, calling a paid AI model) checks `isDryRun()` and does nothing instead.
 * Database writes are handled separately: dry runs execute inside a rolled-back transaction.
 */
const storage = new AsyncLocalStorage<{ dryRun: boolean }>();

export function isDryRun(): boolean {
  return storage.getStore()?.dryRun ?? false;
}

export function withDryRun<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ dryRun: true }, fn);
}
