import { Container, Eyebrow } from "./marketing";

/** Approved client words only. Renders nothing until at least one is approved. */
export function TestimonialsSection({
  items,
}: {
  items: { id: string; quote: string; credit: string }[];
}) {
  if (!items.length) return null;
  const [lead, ...rest] = items;
  return (
    <section className="py-20 sm:py-28" aria-labelledby="testimonials-h">
      <Container>
        <Eyebrow>In their words</Eyebrow>
        <h2 id="testimonials-h" className="sr-only">
          What clients say
        </h2>
        <figure className="mt-6 max-w-4xl">
          <blockquote className="font-display text-ink text-[1.8rem] leading-[1.2] sm:text-[2.4rem]">
            &ldquo;{lead.quote}&rdquo;
          </blockquote>
          <figcaption className="text-muted mt-5">{lead.credit}</figcaption>
        </figure>
        {rest.length > 0 && (
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((t) => (
              <figure
                key={t.id}
                className="border-border/80 bg-surface shadow-card rounded-2xl border p-6"
              >
                <blockquote className="text-ink-soft leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="text-muted mt-4 text-sm">{t.credit}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
