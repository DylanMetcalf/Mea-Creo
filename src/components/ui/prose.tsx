import { renderMarkdown } from "@/lib/markdown";
import { cn } from "./cn";

/** Sanitised markdown body. */
export function Prose({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div
      className={cn("prose-mc", className)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}
