import { describe, expect, it } from "vitest";
import { generatePdf } from "@/lib/pdf";
import { markdownToPdfBlocks } from "@/lib/pdf-markdown";

/** Every xref entry must point at the "N 0 obj" it names, or readers reject the file. */
function assertValidXref(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
  expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
  const entries = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
    Number(m[1]),
  );
  entries.forEach((offset, i) =>
    expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
  );
  return text;
}

describe("branded PDF writer", () => {
  it("embeds the Mea Creo lockups and the document type", () => {
    const text = assertValidXref(
      generatePdf({
        title: "Proposal",
        docType: "Proposal",
        docMeta: "MC-P-0001",
        blocks: [{ type: "title", text: "Hello" }],
      }),
    );
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(text).toContain("(PROPOSAL) Tj");
  });

  it("adds the client logo and paginates long content with a page count", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const text = assertValidXref(
      generatePdf({
        title: "Report",
        docType: "Report",
        clientLogo: { jpeg, w: 10, h: 5 },
        blocks: [{ type: "bullets", items: Array.from({ length: 120 }, (_, i) => `Item ${i}`) }],
      }),
    );
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(3);
    expect(text).toContain("/ImC");
    expect(text).toMatch(/\(1 \/ [2-9]\) Tj/);
  });

  it("escapes PDF syntax and maps typographic characters", () => {
    const text = generatePdf({
      title: "x",
      blocks: [{ type: "p", text: "Smart “quotes” (and) back\\slash — dash" }],
    }).toString("latin1");
    expect(text).toContain('(Smart "quotes" \\(and\\) back\\\\slash - dash) Tj');
  });
});

describe("markdownToPdfBlocks", () => {
  it("maps headings, paragraphs and bullets, and strips inline markup", () => {
    const blocks = markdownToPdfBlocks(
      "Intro **bold** with [a link](https://x.co).\n\n## Rights\n\n- one\n  continued\n- [two](/legal/terms)",
    );
    expect(blocks).toEqual([
      { type: "p", text: "Intro bold with a link (https://x.co)." },
      { type: "h2", text: "Rights" },
      { type: "bullets", items: ["one continued", "two"] },
    ]);
  });
});
