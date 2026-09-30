/**
 * Tiny dependency-free PDF writer for branded text documents (proposals, invoices,
 * reports). Supports headings, paragraphs, bullets, key/value rows and tables,
 * with word wrapping and pagination. Uses the built-in Helvetica fonts.
 */

export type PdfBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string; muted?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "kv"; rows: [string, string][] }
  | { type: "table"; headers: string[]; rows: string[][]; widths: number[]; alignRight?: number[] }
  | { type: "spacer"; size?: number }
  | { type: "rule" };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BRAND = "0.290 0.420 0.345"; // #4a6b58
const INK = "0.098 0.090 0.090";
const MUTED = "0.42 0.40 0.38";

// Approximate Helvetica glyph widths (per 1000 units) for wrapping.
function charWidth(ch: string, bold: boolean): number {
  if (" .,;:'|!ilIjt".includes(ch)) return 280;
  if ("fr()-[]".includes(ch)) return 340;
  if ("mwMW".includes(ch)) return 850;
  if (/[A-Z]/.test(ch)) return bold ? 720 : 680;
  if (/[0-9]/.test(ch)) return 556;
  return bold ? 590 : 540;
}

function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, bold);
  return (w / 1000) * size;
}

/** Map typographic Unicode to WinAnsi-safe characters. */
function sanitise(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function escapePdf(text: string): string {
  return sanitise(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitise(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function generatePdf(input: { title: string; blocks: PdfBlock[]; footer?: string }): Buffer {
  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN;
  const page = () => pages[pages.length - 1];
  const ensure = (height: number) => {
    if (y - height < MARGIN + 20) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
  };
  const text = (
    x: number,
    size: number,
    value: string,
    opts: { bold?: boolean; color?: string } = {},
  ) => {
    page().push(
      `BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${opts.color ?? INK} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(value)}) Tj ET`,
    );
  };

  for (const block of input.blocks) {
    switch (block.type) {
      case "title":
        for (const line of wrap(block.text, 22, CONTENT_W, true)) {
          ensure(30);
          y -= 26;
          text(MARGIN, 22, line, { bold: true });
        }
        y -= 6;
        break;
      case "subtitle":
        for (const line of wrap(block.text, 11, CONTENT_W)) {
          ensure(16);
          y -= 15;
          text(MARGIN, 11, line, { color: MUTED });
        }
        y -= 8;
        break;
      case "h2":
        ensure(40);
        y -= 24;
        text(MARGIN, 13, block.text, { bold: true, color: BRAND });
        y -= 4;
        break;
      case "p":
        for (const line of wrap(block.text, 10.5, CONTENT_W)) {
          ensure(15);
          y -= 14.5;
          text(MARGIN, 10.5, line, { color: block.muted ? MUTED : INK });
        }
        y -= 6;
        break;
      case "bullets":
        for (const item of block.items) {
          const lines = wrap(item, 10.5, CONTENT_W - 14);
          lines.forEach((line, i) => {
            ensure(15);
            y -= 14.5;
            if (i === 0) text(MARGIN, 10.5, "-", { color: BRAND });
            text(MARGIN + 14, 10.5, line);
          });
        }
        y -= 6;
        break;
      case "kv":
        for (const [k, v] of block.rows) {
          const lines = wrap(v, 10.5, CONTENT_W - 160);
          lines.forEach((line, i) => {
            ensure(15);
            y -= 14.5;
            if (i === 0) text(MARGIN, 10.5, k, { color: MUTED });
            text(MARGIN + 160, 10.5, line);
          });
        }
        y -= 6;
        break;
      case "table": {
        const total = block.widths.reduce((a, b) => a + b, 0);
        const widths = block.widths.map((w) => (w / total) * CONTENT_W);
        const drawRow = (cells: string[], bold: boolean) => {
          const wrapped = cells.map((c, i) => wrap(c, 10, widths[i] - 8, bold));
          const height = Math.max(...wrapped.map((w) => w.length)) * 13 + 6;
          ensure(height + 4);
          const top = y;
          wrapped.forEach((lines, i) => {
            const x0 = MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0);
            lines.forEach((line, li) => {
              y = top - 13 * (li + 1);
              const right = block.alignRight?.includes(i);
              const x = right ? x0 + widths[i] - 4 - textWidth(line, 10, bold) : x0 + 4;
              text(x, 10, line, { bold, color: bold ? MUTED : INK });
            });
          });
          y = top - height;
          page().push(
            `${MUTED} RG 0.4 w ${MARGIN} ${(y + 2).toFixed(2)} m ${MARGIN + CONTENT_W} ${(y + 2).toFixed(2)} l S`,
          );
        };
        drawRow(block.headers, true);
        for (const row of block.rows) drawRow(row, false);
        y -= 8;
        break;
      }
      case "spacer":
        y -= block.size ?? 12;
        break;
      case "rule":
        ensure(12);
        y -= 8;
        page().push(
          `${BRAND} RG 1 w ${MARGIN} ${y.toFixed(2)} m ${MARGIN + CONTENT_W} ${y.toFixed(2)} l S`,
        );
        y -= 6;
        break;
    }
  }

  const footer = input.footer ?? "";
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegular = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const fontBold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  const pageIds: number[] = [];
  pages.forEach((ops, index) => {
    const footerOps = `BT /F1 8 Tf ${MUTED} rg ${MARGIN} 30 Td (${escapePdf(`${footer}${footer ? "   |   " : ""}Page ${index + 1} of ${pages.length}`)}) Tj ET`;
    const stream = [...ops, footerOps].join("\n");
    const contentId = add(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const infoId = add(`<< /Title (${escapePdf(input.title)}) /Producer (Mea Creo) >>`);

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
