import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { renderMarkdown } = await import("./markdown");

describe("renderMarkdown", () => {
  it("renders basic markdown", () => {
    expect(renderMarkdown("**Hi** [x](https://a.example)")).toContain("<strong>Hi</strong>");
  });
  it("strips scripts, handlers and javascript: links", () => {
    const html = renderMarkdown("<script>alert(1)</script><img src=x onerror=alert(1)>");
    expect(html).not.toMatch(/<script|onerror/i);
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toMatch(/href="javascript/i);
  });
  it("makes links safe", () => {
    expect(renderMarkdown("[a](https://a.example)")).toContain(
      'rel="noopener noreferrer nofollow"',
    );
  });
});
