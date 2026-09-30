import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { REDACT_PATHS } from "./logger";

describe("logger redaction", () => {
  it("redacts secrets at the top level and one level deep", () => {
    let output = "";
    const sink = new Writable({
      write(chunk, _enc, done) {
        output += chunk.toString();
        done();
      },
    });
    const log = pino({ redact: { paths: REDACT_PATHS, censor: "[redacted]" } }, sink);
    log.info(
      { token: "t-123", xero: { refreshToken: "r-456" }, headers: { authorization: "Bearer abc" } },
      "syncing",
    );
    expect(output).not.toMatch(/t-123|r-456|Bearer abc/);
    expect(output).toContain("[redacted]");
  });
});
