import { ConsentBanner } from "@/components/site/consent";
import { JsonLd } from "@/components/site/marketing";
import { RevealFallback } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getEnv } from "@/config/env";
import { isEnabled } from "@/config/flags";
import { siteConfig } from "@/config/site";
import { settingsDefaults } from "@/modules/settings/schema";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const company = settingsDefaults.company;

export default function SiteLayout({ children }: LayoutProps<"/">) {
  const gaId = isEnabled("GOOGLE_ANALYTICS") ? getEnv().GA_MEASUREMENT_ID : undefined;
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: siteConfig.legalName,
            alternateName: siteConfig.name,
            url: siteUrl,
            logo: `${siteUrl}/brand/lockup-ink.png`,
            email: company.email,
            telephone: company.phone,
            address: {
              "@type": "PostalAddress",
              streetAddress: company.streetAddress,
              postalCode: company.postalCode,
              addressLocality: company.locality,
              addressRegion: company.region,
              addressCountry: siteConfig.contact.countryCode,
            },
            founder: { "@type": "Person", name: "Dylan Metcalf" },
            identifier: siteConfig.registrationNumber,
            sameAs: [company.linkedinUrl, company.instagramUrl, company.facebookUrl].filter(
              Boolean,
            ),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            name: siteConfig.name,
            url: siteUrl,
            publisher: { "@id": `${siteUrl}/#organization` },
          },
        ]}
      />
      <RevealFallback />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter company={company} />
      <ConsentBanner gaId={gaId} />
    </>
  );
}
