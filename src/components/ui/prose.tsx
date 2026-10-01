import { renderMarkdown } from "@/lib/markdown";
import { cn } from "./cn";

/** Sanitised markdown body. `breaks` keeps single line breaks (emails, messages). */
export function Prose({
  markdown,
  className,
  breaks,
}: {
  markdown: string;
  className?: string;
  breaks?: boolean;
}) {
  return (
    <div
      className={cn("prose-mc", className)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown, { breaks }) }}
    />
  );
}
