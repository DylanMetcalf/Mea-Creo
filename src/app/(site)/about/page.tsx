import type { Metadata } from "next";
import {
  CheckList,
  CtaBand,
  Container,
  DisplayHeading,
  Eyebrow,
  Section,
  SectionIntro,
} from "@/components/site/marketing";
import { siteConfig } from "@/config/site";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About",
  description:
    "Mea Creo was founded by Dylan Metcalf to help businesses become easier to find, understand and choose, combining creativity, analytical thinking, technology and business strategy.",
  alternates: { canonical: "/about" },
};

// Founder story and photo supplied by the director; nothing biographical is invented here.
export default function AboutPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div aria-hidden className="bg-aurora absolute inset-0 -z-10 opacity-70" />
        <Container>
          <Eyebrow>About Mea Creo</Eyebrow>
          <DisplayHeading as="h1" className="mt-4 max-w-4xl sm:text-[3.4rem] lg:text-[3.9rem]">
            We help good businesses become easier to find, understand and{" "}
            <span className="text-gradient">choose.</span>
          </DisplayHeading>
          <p className="text-muted mt-6 max-w-2xl text-lg leading-relaxed">
            Digital visibility, search, content, lead generation and automation, built around how
            your buyers actually think and planned as one system for long-term growth.
          </p>
        </Container>
      </section>

      <Section tone="surface">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="relative lg:sticky lg:top-28">
            <Image
              src="/images/dylan-metcalf.jpg"
              alt="Dylan Metcalf, founder of Mea Creo, on the Mpumalanga escarpment"
              width={1600}
              height={1600}
              priority
              sizes="(min-width: 1024px) 520px, 92vw"
              className="shadow-lifted aspect-[4/5] w-full rounded-[24px] object-cover object-[50%_30%]"
            />
            <div className="bg-night/70 absolute bottom-4 left-4 rounded-xl border border-white/15 px-4 py-3 text-white backdrop-blur-md">
              <p className="font-semibold">Dylan Metcalf</p>
              <p className="text-xs text-white/75">Founder and director</p>
            </div>
          </div>
          <div>
            <SectionIntro eyebrow="The founder" title="Dylan Metcalf" />
            <div className="text-ink-soft mt-6 space-y-4 text-lg leading-relaxed">
              <p>
                Dylan started Mea Creo to take his creativity and analytical thinking and build
                something meaningful from them. His strength is understanding both how people think
                and how businesses need to communicate.
              </p>
              <p>
                He enjoys meeting a business where it is today and helping it become a stronger,
                more successful version of itself. He wants clients to feel proud of what&apos;s
                created for them, proud enough to show people their brand, their content, their
                photography, their website and their business.
              </p>
              <p>
                His approach is personal and ownership-driven. He isn&apos;t interested in simply
                being paid to perform a task; he wants to genuinely improve the business.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <SectionIntro eyebrow="How we think" title="Data should inform strategy, not replace it.">
            Many businesses focus so heavily on analytics that they forget what real people want to
            see. We combine data with human psychology, creativity, technology and business
            strategy: brand identity, positioning, story, audience understanding and emotional
            response matter as much as the numbers.
          </SectionIntro>
          <div>
            <p className="font-semibold">What working with Mea Creo feels like</p>
            <div className="mt-4">
              <CheckList
                items={[
                  "Clients are not numbers: we treat your business as if it were our own",
                  "Direct, honest advice, including when something isn't worth doing",
                  "Highly involved, adaptable and quality driven",
                  "Nothing speaks for your business without your approval",
                  "Reports that separate what we did from what actually changed",
                  "No invented results and no guaranteed rankings",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="max-w-3xl">
          <SectionIntro
            eyebrow="Where we work"
            title="Based in Mpumalanga. Working wherever you are."
          />
          <p className="text-muted mt-4 text-lg">
            {siteConfig.legalName} (registration {siteConfig.registrationNumber}) is based near{" "}
            {siteConfig.contact.locality}, {siteConfig.contact.region}, and works with businesses
            across South Africa and beyond, by video call and through the client portal.
          </p>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
