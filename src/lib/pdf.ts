import { BRAND_HEX, pdfRgb } from "@/config/brand";
import { LOCKUP_ON_NIGHT, LOCKUP_ON_WHITE } from "./pdf-assets";

/**
 * Small dependency-free PDF writer for Mea Creo's branded documents: proposals, invoices,
 * reports and statements. Every document gets the same identity as the website: a night
 * header band with the Mea Creo lockup, the signal accent, the client's logo when we have
 * it, branded section headings, tinted tables and a consistent footer.
 *
 * Text uses the built-in Helvetica fonts (no font files to ship); images are JPEG.
 */

export type PdfBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; text: string; muted?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "kv"; rows: [string, string][] }
  /** A tinted panel for the numbers that matter (investment, balance due). */
  | { type: "highlight"; rows: [string, string][]; emphasiseLast?: boolean }
  | { type: "table"; headers: string[]; rows: string[][]; widths: number[]; alignRight?: number[] }
  | { type: "spacer"; size?: number }
  | { type: "rule" };

export interface PdfImage {
  /** JPEG bytes. */
  jpeg: Buffer;
  w: number;
  h: number;
}

export interface PdfInput {
  title: string;
  blocks: PdfBlock[];
  footer?: string;
  /** Shown in the header band, e.g. "PROPOSAL", "TAX INVOICE". */
  docType?: string;
  /** Shown under the doc type, e.g. the number and date. */
  docMeta?: string;
  /** The client's logo, shown in the header band on a white tile. */
  clientLogo?: PdfImage | null;
  clientName?: string;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BAND_H = 128;

const BRAND = pdfRgb(BRAND_HEX.brand600);
const NIGHT = pdfRgb(BRAND_HEX.night);
const SIGNAL = pdfRgb(BRAND_HEX.signal);
const INK = pdfRgb(BRAND_HEX.ink);
const MUTED = pdfRgb(BRAND_HEX.muted);
const BORDER = pdfRgb(BRAND_HEX.border);
const TINT = pdfRgb("#edf6f0");
const DUSK = pdfRgb("#9db7d3");
const NIGHT_MUTED = pdfRgb("#9fb3a8");

// Helvetica / Helvetica-Bold advance widths (per 1000 units) for ASCII 32-126, from the
// standard AFM metrics, so wrapping and right-alignment are exact.
const WIDTHS_REGULAR =
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584"
    .split(" ")
    .map(Number);
const WIDTHS_BOLD =
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 611 556 778 556 556 500 389 280 389 584"
    .split(" ")
    .map(Number);

function charWidth(ch: string, bold: boolean): number {
  const code = ch.charCodeAt(0);
  if (code >= 32 && code <= 126) return (bold ? WIDTHS_BOLD : WIDTHS_REGULAR)[code - 32];
  if (code === 0xb7) return 278;
  return 556;
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
    .replace(/ /g, " ")
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

const fmt = (n: number) => n.toFixed(2);

export function generatePdf(input: PdfInput): Buffer {
  const pages: string[][] = [[]];
  const page = () => pages[pages.length - 1];
  const firstTop = PAGE_H - BAND_H - 34;
  const nextTop = PAGE_H - 78;
  let y = firstTop;
  const ensure = (height: number) => {
    if (y - height < MARGIN + 24) {
      pages.push([]);
      y = nextTop;
    }
  };
  const text = (
    x: number,
    size: number,
    value: string,
    opts: { bold?: boolean; color?: string } = {},
    at = y,
  ) => {
    page().push(
      `BT /${opts.bold ? "F2" : "F1"} ${size} Tf ${opts.color ?? INK} rg ${fmt(x)} ${fmt(at)} Td (${escapePdf(value)}) Tj ET`,
    );
  };
  const rect = (x: number, ry: number, w: number, h: number, color: string) =>
    page().push(`${color} rg ${fmt(x)} ${fmt(ry)} ${fmt(w)} ${fmt(h)} re f`);

  for (const block of input.blocks) {
    switch (block.type) {
      case "title":
        for (const line of wrap(block.text, 24, CONTENT_W, true)) {
          ensure(32);
          y -= 28;
          text(MARGIN, 24, line, { bold: true });
        }
        y -= 6;
        break;
      case "subtitle":
        for (const line of wrap(block.text, 11, CONTENT_W)) {
          ensure(16);
          y -= 15;
          text(MARGIN, 11, line, { color: MUTED });
        }
        y -= 10;
        break;
      case "h2":
        // Keep a heading with at least a few lines of what follows it.
        ensure(96);
        y -= 28;
        rect(MARGIN, y - 1, 3, 12, SIGNAL);
        rect(MARGIN, y - 1, 3, 6, BRAND);
        text(MARGIN + 10, 13, block.text, { bold: true, color: INK });
        y -= 6;
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
          const lines = wrap(item, 10.5, CONTENT_W - 16);
          lines.forEach((line, i) => {
            ensure(15);
            y -= 14.5;
            if (i === 0) rect(MARGIN + 1, y + 2.5, 4, 4, BRAND);
            text(MARGIN + 16, 10.5, line);
          });
        }
        y -= 6;
        break;
      case "kv":
        for (const [k, v] of block.rows) {
          const lines = wrap(v, 10.5, CONTENT_W - 150);
          lines.forEach((line, i) => {
            ensure(15);
            y -= 14.5;
            if (i === 0) text(MARGIN, 10.5, k, { color: MUTED });
            text(MARGIN + 150, 10.5, line);
          });
        }
        y -= 6;
        break;
      case "highlight": {
        const rowH = 20;
        const h = block.rows.length * rowH + 16;
        ensure(h + 8);
        y -= 8;
        rect(MARGIN, y - h, CONTENT_W, h, TINT);
        rect(MARGIN, y - h, 3, h, BRAND);
        let ry = y - 8;
        block.rows.forEach(([k, v], i) => {
          ry -= rowH;
          const last = block.emphasiseLast && i === block.rows.length - 1;
          const size = last ? 13 : 10.5;
          text(MARGIN + 16, size, k, { color: last ? INK : MUTED, bold: last }, ry + 6);
          text(
            MARGIN + CONTENT_W - 14 - textWidth(v, size, true),
            size,
            v,
            { bold: true, color: last ? pdfRgb(BRAND_HEX.brand700) : INK },
            ry + 6,
          );
        });
        y -= h + 10;
        break;
      }
      case "table": {
        const total = block.widths.reduce((a, b) => a + b, 0);
        const widths = block.widths.map((w) => (w / total) * CONTENT_W);
        const drawRow = (cells: string[], header: boolean) => {
          const size = header ? 8.5 : 10;
          const wrapped = cells.map((c, i) =>
            wrap(header ? c.toUpperCase() : c, size, widths[i] - 12, header),
          );
          const height = Math.max(...wrapped.map((w) => w.length)) * 13 + 10;
          ensure(height + 4);
          const top = y;
          if (header) rect(MARGIN, top - height, CONTENT_W, height, TINT);
          wrapped.forEach((lines, i) => {
            const x0 = MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0);
            lines.forEach((line, li) => {
              const ly = top - 4 - 13 * (li + 1);
              const right = block.alignRight?.includes(i);
              const x = right ? x0 + widths[i] - 8 - textWidth(line, size, header) : x0 + 8;
              text(x, size, line, { bold: header, color: header ? MUTED : INK }, ly);
            });
          });
          y = top - height;
          if (!header)
            page().push(
              `${BORDER} RG 0.6 w ${MARGIN} ${fmt(y)} m ${MARGIN + CONTENT_W} ${fmt(y)} l S`,
            );
        };
        y -= 4;
        // Never leave the header row alone at the foot of a page.
        ensure(64);
        drawRow(block.headers, true);
        for (const row of block.rows) drawRow(row, false);
        y -= 10;
        break;
      }
      case "spacer":
        y -= block.size ?? 12;
        break;
      case "rule":
        ensure(14);
        y -= 9;
        page().push(`${BORDER} RG 0.8 w ${MARGIN} ${fmt(y)} m ${MARGIN + CONTENT_W} ${fmt(y)} l S`);
        y -= 7;
        break;
    }
  }

  // ---- Assemble objects ----
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
  const image = (img: PdfImage) => {
    const bytes = img.jpeg.toString("latin1");
    return add(
      `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n${bytes}\nendstream`,
    );
  };
  const lockNight = image({
    jpeg: Buffer.from(LOCKUP_ON_NIGHT.b64, "base64"),
    w: LOCKUP_ON_NIGHT.w,
    h: LOCKUP_ON_NIGHT.h,
  });
  const lockWhite = image({
    jpeg: Buffer.from(LOCKUP_ON_WHITE.b64, "base64"),
    w: LOCKUP_ON_WHITE.w,
    h: LOCKUP_ON_WHITE.h,
  });
  const clientImg = input.clientLogo ? image(input.clientLogo) : null;

  const draw = (name: string, x: number, dy: number, w: number, h: number) =>
    `q ${fmt(w)} 0 0 ${fmt(h)} ${fmt(x)} ${fmt(dy)} cm /${name} Do Q`;
  const t = (x: number, ty: number, size: number, value: string, color: string, bold = false) =>
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${fmt(x)} ${fmt(ty)} Td (${escapePdf(value)}) Tj ET`;

  const footer = input.footer ?? "";
  const pageIds: number[] = [];
  pages.forEach((ops, index) => {
    const chrome: string[] = [];
    if (index === 0) {
      // Header band: night, with a signal-to-dusk accent line underneath.
      chrome.push(`${NIGHT} rg 0 ${fmt(PAGE_H - BAND_H)} ${PAGE_W} ${BAND_H} re f`);
      const third = PAGE_W / 3;
      chrome.push(`${BRAND} rg 0 ${fmt(PAGE_H - BAND_H - 3)} ${fmt(third)} 3 re f`);
      chrome.push(`${SIGNAL} rg ${fmt(third)} ${fmt(PAGE_H - BAND_H - 3)} ${fmt(third)} 3 re f`);
      chrome.push(`${DUSK} rg ${fmt(third * 2)} ${fmt(PAGE_H - BAND_H - 3)} ${fmt(third)} 3 re f`);
      const lh = 46;
      const lw = (LOCKUP_ON_NIGHT.w / LOCKUP_ON_NIGHT.h) * lh;
      chrome.push(draw("ImL", MARGIN - 6, PAGE_H - BAND_H / 2 - lh / 2, lw, lh));
      const rightX = PAGE_W - MARGIN;
      if (clientImg && input.clientLogo) {
        const boxH = 64;
        const boxW = 132;
        const bx = rightX - boxW;
        const by = PAGE_H - BAND_H / 2 - boxH / 2;
        chrome.push(`1 1 1 rg ${fmt(bx)} ${fmt(by)} ${boxW} ${boxH} re f`);
        const scale = Math.min((boxW - 16) / input.clientLogo.w, (boxH - 16) / input.clientLogo.h);
        const iw = input.clientLogo.w * scale;
        const ih = input.clientLogo.h * scale;
        chrome.push(draw("ImC", bx + (boxW - iw) / 2, by + (boxH - ih) / 2, iw, ih));
        if (input.docType) {
          const label = `${input.docType.toUpperCase()}  FOR`;
          chrome.push(
            t(bx - 14 - textWidth(label, 8, true), by + boxH - 12, 8, label, SIGNAL, true),
          );
          if (input.docMeta)
            chrome.push(
              t(
                bx - 14 - textWidth(input.docMeta, 8.5),
                by + boxH - 26,
                8.5,
                input.docMeta,
                NIGHT_MUTED,
              ),
            );
        }
      } else if (input.docType) {
        const label = input.docType.toUpperCase();
        chrome.push(t(rightX - textWidth(label, 9, true), PAGE_H - 58, 9, label, SIGNAL, true));
        if (input.docMeta)
          chrome.push(
            t(rightX - textWidth(input.docMeta, 9), PAGE_H - 73, 9, input.docMeta, NIGHT_MUTED),
          );
        if (input.clientName)
          chrome.push(
            t(
              rightX - textWidth(input.clientName, 11, true),
              PAGE_H - 92,
              11,
              input.clientName,
              "1 1 1",
              true,
            ),
          );
      }
    } else {
      // Continuation header: small lockup and the document title.
      const lh = 22;
      const lw = (LOCKUP_ON_WHITE.w / LOCKUP_ON_WHITE.h) * lh;
      chrome.push(draw("ImW", MARGIN - 3, PAGE_H - 50, lw, lh));
      const label = sanitise(input.title).slice(0, 70);
      chrome.push(t(PAGE_W - MARGIN - textWidth(label, 8.5), PAGE_H - 42, 8.5, label, MUTED));
      chrome.push(
        `${BORDER} RG 0.6 w ${MARGIN} ${fmt(PAGE_H - 58)} m ${PAGE_W - MARGIN} ${fmt(PAGE_H - 58)} l S`,
      );
    }
    // Footer on every page.
    chrome.push(`${BORDER} RG 0.6 w ${MARGIN} 44 m ${PAGE_W - MARGIN} 44 l S`);
    chrome.push(`${SIGNAL} rg ${MARGIN} 43 18 1.6 re f`);
    chrome.push(t(MARGIN, 30, 8, footer, MUTED));
    const num = `${index + 1} / ${pages.length}`;
    chrome.push(t(PAGE_W - MARGIN - textWidth(num, 8), 30, 8, num, MUTED));

    const stream = [...chrome, ...ops].join("\n");
    const contentId = add(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    const xobjects = `/XObject << /ImL ${lockNight} 0 R /ImW ${lockWhite} 0 R${clientImg ? ` /ImC ${clientImg} 0 R` : ""} >>`;
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> ${xobjects} >> /Contents ${contentId} 0 R >>`,
      ),
    );
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const infoId = add(
    `<< /Title (${escapePdf(input.title)}) /Producer (Mea Creo) /Creator (Mea Creo) >>`,
  );

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
