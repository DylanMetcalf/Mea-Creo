import type { PdfBlock } from "./pdf";

/** Inline markdown to plain text: emphasis markers dropped, links kept as "text (url)". */
function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Converts the simple markdown used in our content (headings, paragraphs, bullet lists)
 * into PDF blocks, so legal documents print with the same branding as everything else.
 */
export function markdownToPdfBlocks(markdown: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: inline(paragraph.join(" ")) });
    if (bullets.length) blocks.push({ type: "bullets", items: bullets.map(inline) });
    paragraph = [];
    bullets = [];
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (/^#{1,4}\s/.test(line)) {
      flush();
      blocks.push({ type: "h2", text: inline(line.replace(/^#+\s*/, "")) });
    } else if (/^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      if (paragraph.length) flush();
      bullets.push(line.replace(/^([-*]|\d+\.)\s+/, ""));
    } else if (bullets.length) {
      bullets[bullets.length - 1] += ` ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
