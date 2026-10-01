import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function Section({
  className,
  children,
  id,
  tone = "paper",
}: {
  className?: string;
  children: ReactNode;
  id?: string;
  tone?: "paper" | "surface" | "brand";
}) {
  return (
    <section
      id={id}
      className={cn(
        "py-16 sm:py-24",
        tone === "surface" && "border-border bg-surface border-y",
        tone === "brand" && "bg-brand-900 text-white",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.14em] uppercase",
        inverse ? "text-brand-300" : "text-brand-600",
      )}
    >
      {children}
    </p>
  );
}

export function DisplayHeading({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: "h1" | "h2" | "h3";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "font-display text-3xl leading-[1.12] tracking-tight text-balance sm:text-[2.6rem]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  children,
  align = "left",
  inverse,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  inverse?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow inverse={inverse}>{eyebrow}</Eyebrow>}
      <DisplayHeading className={cn("mt-3", inverse && "text-white")}>{title}</DisplayHeading>
      {children && (
        <div
          className={cn("mt-4 text-lg leading-relaxed", inverse ? "text-brand-100" : "text-muted")}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function CheckList({ items, inverse }: { items: string[]; inverse?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <Check
            className={cn("mt-0.5 size-4 shrink-0", inverse ? "text-brand-300" : "text-brand-600")}
            aria-hidden
          />
          <span className={inverse ? "text-brand-50" : "text-ink-soft"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CtaBand({
  title = "Let's talk about where your business could be.",
  body = "Book a 30-minute strategy conversation with Dylan, or start with a free Visibility Report of your website.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Section tone="brand">
      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <DisplayHeading className="text-white">{title}</DisplayHeading>
          <p className="text-brand-100 mt-3 text-lg">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/book" variant="inverse" size="lg">
            Book a strategy conversation <ArrowRight className="size-4" aria-hidden />
          </LinkButton>
          <LinkButton
            href="/visibility-report"
            variant="ghost"
            size="lg"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            Get a free Visibility Report
          </LinkButton>
        </div>
      </div>
    </Section>
  );
}

export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="divide-border rounded-card border-border bg-surface divide-y border">
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-4">
          <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
            {item.question}
            <span aria-hidden className="text-brand-600 transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="text-ink-soft mt-3">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** JSON-LD structured data. Only ever describe things that are true. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
