import { siteConfig } from "@/config/site";

/**
 * Phase 1 placeholder. The public website (Phase 5) replaces this page.
 * The live site stays on Wix until the launch checklist in docs/MIGRATION.md is complete.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-24 sm:px-6">
      <p className="text-primary text-sm font-medium tracking-wide uppercase">{siteConfig.name}</p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        Get found. Get noticed. Grow.
      </h1>
      <p className="text-muted max-w-2xl text-lg">{siteConfig.description}</p>
      <p className="text-muted text-sm">
        The new site is being built. In the meantime, contact{" "}
        <a
          className="text-primary font-medium underline underline-offset-4"
          href={`mailto:${siteConfig.contact.email}`}
        >
          {siteConfig.contact.email}
        </a>
        .
      </p>
    </main>
  );
}
