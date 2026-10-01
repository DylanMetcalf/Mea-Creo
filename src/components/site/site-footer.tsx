import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { siteConfig } from "@/config/site";

const columns = [
  {
    title: "Services",
    links: [
      ["/services/visibility", "Visibility"],
      ["/services/growth", "Growth"],
      ["/services/content", "Content"],
      ["/services/technology", "Technology"],
      ["/services/consulting", "Consulting"],
      ["/services/quality-assurance", "Quality assurance"],
      ["/pricing", "Pricing"],
    ],
  },
  {
    title: "Company",
    links: [
      ["/how-it-works", "How it works"],
      ["/work", "Work & results"],
      ["/insights", "Insights"],
      ["/about", "About"],
      ["/contact", "Contact"],
    ],
  },
  {
    title: "Get started",
    links: [
      ["/visibility-report", "Free Visibility Report"],
      ["/book", "Book a strategy call"],
      ["/login", "Client sign in"],
    ],
  },
];

export function SiteFooter({
  company,
}: {
  company?: {
    email: string;
    phone: string;
    locality: string;
    country: string;
    linkedinUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
  };
}) {
  const c = company ?? {
    ...siteConfig.contact,
    linkedinUrl: undefined,
    instagramUrl: undefined,
    facebookUrl: undefined,
  };
  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="text-muted max-w-xs text-sm">
            Visibility, growth and automation for businesses that want to be easier to find,
            understand and choose.
          </p>
          <address className="text-ink-soft space-y-1 text-sm not-italic">
            <a href={`mailto:${c.email}`} className="hover:text-brand-700 block">
              {c.email}
            </a>
            <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-brand-700 block">
              {c.phone}
            </a>
            <span className="text-muted block">
              {c.locality}, {c.country}
            </span>
          </address>
          <div className="flex gap-3 text-sm">
            {c.linkedinUrl && (
              <a href={c.linkedinUrl} rel="noopener" className="text-muted hover:text-ink">
                LinkedIn
              </a>
            )}
            {c.instagramUrl && (
              <a href={c.instagramUrl} rel="noopener" className="text-muted hover:text-ink">
                Instagram
              </a>
            )}
            {c.facebookUrl && (
              <a href={c.facebookUrl} rel="noopener" className="text-muted hover:text-ink">
                Facebook
              </a>
            )}
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-ink text-sm font-semibold">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-ink text-sm">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-border border-t">
        <div className="text-muted mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName} · Reg.{" "}
            {siteConfig.registrationNumber}. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/cookies" className="hover:text-ink">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
