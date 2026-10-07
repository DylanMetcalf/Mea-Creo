import Link from "next/link";
import { CookieSettingsButton } from "./consent";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
    <footer className="bg-night text-night-text relative isolate mt-auto overflow-hidden">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(50%_80%_at_0%_0%,#000,transparent)] opacity-70"
      />
      <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <p className="font-display max-w-3xl text-[2rem] leading-[1.08] text-white sm:text-[2.6rem]">
          Easier to find. Easier to understand.{" "}
          <span className="text-gradient-night">Easier to choose.</span>
        </p>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="space-y-5">
          <Logo inverse />
          <p className="text-night-muted max-w-xs text-sm leading-relaxed">
            Visibility, growth and automation for businesses that want to be easier to find,
            understand and choose.
          </p>
          <address className="space-y-1 text-sm not-italic">
            <a href={`mailto:${c.email}`} className="hover:text-signal block transition-colors">
              {c.email}
            </a>
            <a
              href={`tel:${c.phone.replace(/\s/g, "")}`}
              className="hover:text-signal block transition-colors"
            >
              {c.phone}
            </a>
            <span className="text-night-muted block">
              {c.locality}, {c.country}
            </span>
          </address>
          <div className="flex gap-3 text-sm">
            {c.linkedinUrl && (
              <a href={c.linkedinUrl} rel="noopener" className="text-night-muted hover:text-white">
                LinkedIn
              </a>
            )}
            {c.instagramUrl && (
              <a href={c.instagramUrl} rel="noopener" className="text-night-muted hover:text-white">
                Instagram
              </a>
            )}
            {c.facebookUrl && (
              <a href={c.facebookUrl} rel="noopener" className="text-night-muted hover:text-white">
                Facebook
              </a>
            )}
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="label-mono text-night-muted">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-night-text/90 text-sm transition-colors hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-night-line border-t">
        <div className="text-night-muted mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {siteConfig.legalName} · Reg.{" "}
            {siteConfig.registrationNumber}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggle inverse />
            <Link href="/legal/popia" className="hover:text-white">
              POPIA
            </Link>
            <Link href="/legal/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/legal/cookies" className="hover:text-white">
              Cookies
            </Link>
            <CookieSettingsButton className="hover:text-white" />
          </div>
        </div>
      </div>
    </footer>
  );
}
