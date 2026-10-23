import { NewsletterForm } from "./newsletter-form";

/** The newsletter invitation used on the blog: one calm panel, never a pop-up. */
export function NewsletterPanel({
  source,
  className = "",
}: {
  source: string;
  className?: string;
}) {
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className={`border-border bg-surface rounded-card mt-14 grid grid-cols-1 gap-8 border p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] ${className}`}
    >
      <div>
        <p className="label-mono text-brand-700">Newsletter</p>
        <h2 id="newsletter-heading" className="font-display mt-2 text-2xl">
          Useful ideas, now and then.
        </h2>
        <p className="text-muted mt-3">
          Practical notes on being found, trusted and chosen: search and AI visibility, LinkedIn,
          content and automation. Only when there&apos;s something worth saying. No sharing your
          address, ever.
        </p>
      </div>
      <NewsletterForm source={source} />
    </section>
  );
}
