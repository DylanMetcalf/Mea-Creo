import { describe, expect, it } from "vitest";
import { AppError, statusOf, toPublicError } from "./errors";

describe("toPublicError", () => {
  it("returns the user-safe message for application errors", () => {
    const error = new AppError("FORBIDDEN", { message: "user 42 tried to read org 7 document 9" });
    expect(toPublicError(error)).toEqual({
      code: "FORBIDDEN",
      message: "You don't have access to this.",
      retryable: false,
    });
    expect(statusOf(error)).toBe(403);
  });

  it("never leaks internal messages from unknown errors", () => {
    const publicError = toPublicError(new Error("password=hunter2 at db.ts:12"));
    expect(publicError.code).toBe("INTERNAL");
    expect(JSON.stringify(publicError)).not.toContain("hunter2");
    expect(statusOf(new Error("x"))).toBe(500);
  });

  it("marks integration failures as retryable", () => {
    expect(new AppError("INTEGRATION_FAILED").retryable).toBe(true);
    expect(new AppError("VALIDATION").retryable).toBe(false);
  });
});
