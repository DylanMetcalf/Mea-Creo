import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
  );
}

export type SectionTone = "paper" | "surface" | "night" | "horizon" | "brand";

/**
 * Page rhythm: paper (mist) and surface (white) carry content; night is the dark
 * technology section; horizon is the signature gradient moment. "brand" is kept as
 * an alias of night for older pages.
 */
export function Section({
  className,
  children,
  id,
  tone = "paper",
  containerClassName,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
  tone?: SectionTone;
  containerClassName?: string;
}) {
  const dark = tone === "night" || tone === "horizon" || tone === "brand";
  return (
    <section
      id={id}
      className={cn(
        "relative isolate overflow-hidden py-20 sm:py-28",
        tone === "surface" && "bg-surface",
        dark && "bg-night text-night-text",
        tone === "horizon" && "bg-horizon",
        className,
      )}
    >
      {dark && (
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent)] opacity-60"
        />
      )}
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return (
    <p
      className={cn(
        "label-mono inline-flex items-center gap-2",
        inverse ? "text-signal" : "text-brand-600",
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", inverse ? "bg-signal" : "bg-brand-500")}
      />
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
        "font-display text-[2rem] leading-[1.08] text-balance sm:text-[2.6rem] lg:text-[2.9rem]",
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
      <DisplayHeading className={cn("mt-4", inverse && "text-white")}>{title}</DisplayHeading>
      {children && (
        <div
          className={cn(
            "mt-5 text-[1.075rem] leading-relaxed",
            inverse ? "text-night-muted" : "text-muted",
          )}
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
          <span
            aria-hidden
            className={cn(
              "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full",
              inverse ? "bg-signal/15 text-signal" : "bg-brand-100 text-brand-700",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className={inverse ? "text-night-text" : "text-ink-soft"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The signature closing moment: horizon gradient, light, and the two primary actions. */
export function CtaBand({
  title = "Let's talk about where your business could be.",
  body = "Book a 30-minute strategy conversation with Dylan, or start with a free Visibility Report of your website.",
  bookHref = "/book",
  showReport = true,
}: {
  title?: string;
  body?: string;
  bookHref?: string;
  showReport?: boolean;
}) {
  return (
    <section className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="bg-horizon relative isolate overflow-hidden rounded-[28px] px-6 py-16 text-white sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_80%_at_80%_100%,#000,transparent)]"
        />
        <div
          aria-hidden
          className="bg-ember-500/30 pointer-events-none absolute -right-24 -bottom-40 -z-10 size-[520px] rounded-full blur-3xl"
        />
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Eyebrow inverse>Next step</Eyebrow>
            <DisplayHeading className="mt-4 text-white sm:text-[3.2rem]">{title}</DisplayHeading>
            <p className="text-night-muted mt-5 text-lg">{body}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <LinkButton href={bookHref} variant="inverse" size="xl">
              Book a strategy call
              <ArrowRight
                className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                aria-hidden
              />
            </LinkButton>
            {showReport && (
              <LinkButton href="/visibility-report" variant="glass" size="xl">
                Get your free Visibility Report
              </LinkButton>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="divide-border/80 border-border/80 divide-y border-y">
      {items.map((item) => (
        <details key={item.question} className="group py-5">
          <summary className="text-ink hover:text-brand-700 flex cursor-pointer list-none items-center justify-between gap-4 text-[1.05rem] font-medium transition-colors [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden
              className="border-border text-brand-600 group-open:bg-brand-700 flex size-7 shrink-0 items-center justify-center rounded-full border text-lg leading-none transition-all duration-300 group-open:rotate-45 group-open:border-transparent group-open:text-white"
            >
              +
            </span>
          </summary>
          <p className="text-muted mt-3 max-w-3xl leading-relaxed">{item.answer}</p>
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
