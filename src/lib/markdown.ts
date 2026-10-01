import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Renders untrusted markdown (AI drafts, CMS content, client messages) to safe HTML.
 * Only a small allow-list of tags survives; links open safely and scripts never do.
 */
export function renderMarkdown(source: string, options: { breaks?: boolean } = {}): string {
  const html = marked.parse(source, { async: false, gfm: true, breaks: options.breaks ?? false });
  return sanitizeHtml(html, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "a",
      "blockquote",
      "code",
      "pre",
      "hr",
      "br",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: { a: ["href", "title", "rel", "target"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
      h1: "h2",
    },
  });
}
