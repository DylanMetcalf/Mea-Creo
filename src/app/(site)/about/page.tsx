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

export const metadata: Metadata = {
  title: "About",
  description:
    "Mea Creo is a visibility, growth and automation company founded and run by Dylan Metcalf.",
  alternates: { canonical: "/about" },
};

// TODO(owner): add Dylan's own bio and a photo. Nothing biographical is invented here.
export default function AboutPage() {
  return (
    <>
      <section className="pt-14 pb-10 sm:pt-20">
        <Container>
          <Eyebrow>About</Eyebrow>
          <DisplayHeading as="h1" className="mt-3 max-w-3xl sm:text-5xl">
            Mea Creo helps good businesses become easier to find, trust and choose.
          </DisplayHeading>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            We combine search visibility, AI discoverability, content, lead generation and
            automation into one system, run with care and reported honestly.
          </p>
        </Container>
      </section>
      <Section tone="surface">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <SectionIntro eyebrow="Who you work with" title="Dylan Metcalf, founder.">
            Dylan founded Mea Creo and leads every client relationship personally. When you work
            with Mea Creo, you deal with the person accountable for the work.
          </SectionIntro>
          <div>
            <p className="font-semibold">How we work</p>
            <div className="mt-4">
              <CheckList
                items={[
                  "Specialised software handles repetitive analysis and preparation",
                  "A person reviews the work before it reaches you",
                  "Nothing speaks for your business without your approval",
                  "Reports separate what we did from what actually changed",
                  "No invented results, no guaranteed rankings",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>
      <Section>
        <div className="max-w-3xl">
          <SectionIntro
            eyebrow="Where we work"
            title="Based in Pretoria. Working wherever you are."
          />
          <p className="text-muted mt-4 text-lg">
            Mea Creo works with businesses across South Africa and internationally, by video call
            and through the client portal.
          </p>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
