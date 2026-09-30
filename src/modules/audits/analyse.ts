import {
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditCategoryKey,
  type AuditFinding,
  type AuditOpportunity,
  type AuditResult,
  type AuditSignals,
  type CategoryStatus,
  type CompetitorComparison,
  type Impact,
} from "./types";

type Finding = Omit<AuditFinding, "id"> & { key: string };

const CATEGORY_SERVICE: Record<AuditCategoryKey, string | undefined> = {
  website: "website-development",
  search: "seo",
  technical: "technical-seo",
  content: "content-creation",
  ai_discoverability: "geo",
  answer_readiness: "aeo",
  local: "local-google-visibility",
  social: "linkedin-networking",
  conversion: "conversion-optimisation",
  competitors: "seo",
};

const pass = (
  key: string,
  title: string,
  whatIsHappening: string,
  whyItMatters: string,
  evidence?: string,
): Finding => ({
  key,
  status: "pass",
  title,
  whatIsHappening,
  whyItMatters,
  whatToDo: "Keep this in place as the site changes.",
  evidence,
  impact: "low",
});

const issue = (
  status: "warn" | "fail",
  impact: Impact,
  key: string,
  title: string,
  whatIsHappening: string,
  whyItMatters: string,
  whatToDo: string,
  evidence?: string,
): Finding => ({ key, status, impact, title, whatIsHappening, whyItMatters, whatToDo, evidence });

const notMeasured = (
  key: string,
  title: string,
  whatIsHappening: string,
  whyItMatters: string,
  whatToDo: string,
): Finding => ({
  key,
  status: "not_measured",
  impact: "medium",
  title,
  whatIsHappening,
  whyItMatters,
  whatToDo,
});

function websiteFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  f.push(
    s.https
      ? pass(
          "https",
          "Secure connection (HTTPS)",
          "The site loads securely over HTTPS.",
          "Browsers flag insecure sites and search engines prefer secure ones.",
        )
      : issue(
          "fail",
          "high",
          "https",
          "Site is not served securely",
          "The site does not load over HTTPS.",
          "Visitors see 'Not secure' warnings, which damages trust and enquiries. Search engines also treat HTTPS as a signal.",
          "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
        ),
  );
  f.push(
    s.viewport
      ? pass(
          "viewport",
          "Mobile-ready page setup",
          "The page declares a mobile viewport.",
          "Most B2B research now starts on a phone.",
        )
      : issue(
          "fail",
          "high",
          "viewport",
          "No mobile viewport",
          "The page has no mobile viewport tag, so it may render as a zoomed-out desktop page on phones.",
          "Google indexes the mobile version of your site first; a poor mobile experience costs rankings and enquiries.",
          "Add a responsive viewport meta tag and check key pages on a phone.",
        ),
  );
  if (s.responseTimeMs > 3000) {
    f.push(
      issue(
        "warn",
        "medium",
        "speed",
        "Slow first response",
        `The home page took about ${(s.responseTimeMs / 1000).toFixed(1)} seconds to respond when we checked.`,
        "Slow pages lose visitors before they read anything, and speed feeds into search rankings.",
        "Review hosting, caching and page weight. Run a full PageSpeed test on key pages.",
        `${s.responseTimeMs} ms`,
      ),
    );
  } else {
    f.push(
      pass(
        "speed",
        "Server responds quickly",
        `The home page responded in about ${(s.responseTimeMs / 1000).toFixed(1)} seconds.`,
        "Fast responses keep visitors engaged.",
        `${s.responseTimeMs} ms`,
      ),
    );
  }
  if (s.htmlBytes > 1_000_000) {
    f.push(
      issue(
        "warn",
        "medium",
        "weight",
        "Very heavy page code",
        `The home page HTML alone is about ${(s.htmlBytes / 1_000_000).toFixed(1)} MB before images and scripts.`,
        "Heavy pages load slowly on mobile networks, which hurts both visitors and Core Web Vitals.",
        "Reduce page-builder bloat, unused scripts and inline styles, or move to a lighter platform.",
      ),
    );
  }
  if (!s.lang)
    f.push(
      issue(
        "warn",
        "low",
        "lang",
        "Page language not declared",
        "The page does not declare its language.",
        "Screen readers and search engines use it to interpret content correctly.",
        'Add a lang attribute such as lang="en-ZA" to the html element.',
      ),
    );
  if (!s.favicon)
    f.push(
      issue(
        "warn",
        "low",
        "favicon",
        "No site icon",
        "No favicon was found.",
        "The icon appears in browser tabs and some search results and makes the brand easier to recognise.",
        "Add a favicon and app icons.",
      ),
    );
  return f;
}

function searchFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  const title = s.title?.trim();
  if (!title) {
    f.push(
      issue(
        "fail",
        "high",
        "title",
        "Missing page title",
        "The home page has no title tag.",
        "The title is the headline searchers see in Google. Without it, search engines invent one.",
        "Write a title that says what you do and for whom, e.g. 'Industrial pump maintenance in Gauteng | Company'.",
      ),
    );
  } else if (title.length < 25 || title.split(/\s+/).length <= 3) {
    f.push(
      issue(
        "warn",
        "high",
        "title",
        "Title says little about what you do",
        `The title is "${title}".`,
        "Search engines and searchers use the title to decide whether your page matches what they need. A name-only or vague title wastes your most important search signal.",
        "Include your main service and location or audience alongside the brand name.",
        title,
      ),
    );
  } else if (title.length > 65) {
    f.push(
      issue(
        "warn",
        "low",
        "title",
        "Title may be cut off in search results",
        `The title is ${title.length} characters long.`,
        "Google shows roughly 50–60 characters; the end of your message may be lost.",
        "Put the most important words first and keep it under about 60 characters.",
        title,
      ),
    );
  } else {
    f.push(
      pass(
        "title",
        "Clear page title",
        `The title is "${title}".`,
        "It gives searchers a clear headline.",
        title,
      ),
    );
  }

  const desc = s.metaDescription?.trim();
  if (!desc) {
    f.push(
      issue(
        "fail",
        "medium",
        "description",
        "Missing meta description",
        "The home page has no meta description.",
        "The description is the short summary under your search result. A good one increases the share of people who click.",
        "Write a 120–160 character description that states the service, the audience and a reason to click.",
      ),
    );
  } else if (desc.length < 70 || desc.length > 170) {
    f.push(
      issue(
        "warn",
        "low",
        "description",
        "Meta description length could be improved",
        `The description is ${desc.length} characters.`,
        "Too short wastes space; too long gets cut off.",
        "Aim for 120–160 characters with a clear benefit.",
        desc,
      ),
    );
  } else {
    f.push(
      pass(
        "description",
        "Meta description present",
        "A search summary is in place.",
        "It shapes how your result appears in Google.",
        desc,
      ),
    );
  }

  if (s.h1.length === 0) {
    f.push(
      issue(
        "fail",
        "medium",
        "h1",
        "No main heading (H1)",
        "The page has no H1 heading.",
        "The H1 tells search engines and AI systems the main topic of the page.",
        "Add one H1 that states what you do in plain language.",
      ),
    );
  } else if (s.h1.length > 1) {
    f.push(
      issue(
        "warn",
        "low",
        "h1",
        "Several main headings",
        `The page has ${s.h1.length} H1 headings.`,
        "Multiple H1s blur the main topic of the page.",
        "Use a single H1 and turn the rest into H2 subheadings.",
        s.h1.slice(0, 3).join(" · "),
      ),
    );
  } else {
    const generic =
      s.h1[0].split(/\s+/).length <= 4 &&
      !/\b(for|in|services?|solutions?|engineering|consult|agency|company)\b/i.test(s.h1[0]);
    f.push(
      generic
        ? issue(
            "warn",
            "medium",
            "h1",
            "Main heading is a slogan, not a description",
            `The H1 is "${s.h1[0]}".`,
            "Slogans are memorable but carry no search meaning. Searchers and AI systems can't tell what you offer.",
            "Keep the slogan as a supporting line and make the H1 describe the service and audience.",
            s.h1[0],
          )
        : pass(
            "h1",
            "Descriptive main heading",
            `The H1 is "${s.h1[0]}".`,
            "It states the page topic clearly.",
            s.h1[0],
          ),
    );
  }

  if (s.robotsMeta && /noindex/i.test(s.robotsMeta)) {
    f.push(
      issue(
        "fail",
        "high",
        "noindex",
        "Home page is hidden from search",
        `The page tells search engines not to index it (robots: "${s.robotsMeta}").`,
        "A noindexed page cannot appear in Google at all.",
        "Remove the noindex directive unless it is intentional.",
      ),
    );
  }
  if (!s.canonical) {
    f.push(
      issue(
        "warn",
        "low",
        "canonical",
        "No canonical URL",
        "The page doesn't declare its preferred URL.",
        "Without it, duplicate versions of a page can compete with each other.",
        "Add a canonical link tag to each page.",
      ),
    );
  }
  f.push(
    notMeasured(
      "performance",
      "Actual search performance",
      "Rankings, impressions and clicks aren't visible from the outside.",
      "These are the numbers that show whether visibility is improving.",
      "Connect Google Search Console so we can measure real search performance.",
    ),
  );
  return f;
}

function technicalFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  if (!s.robotsTxt.found) {
    f.push(
      issue(
        "warn",
        "low",
        "robots",
        "No robots.txt file",
        "The site has no robots.txt.",
        "It's the first file crawlers read and the usual place to point them to your sitemap.",
        "Add a robots.txt that allows crawling and lists your sitemap.",
      ),
    );
  } else if (s.robotsTxt.blocksAll) {
    f.push(
      issue(
        "fail",
        "high",
        "robots",
        "robots.txt blocks all crawlers",
        "robots.txt disallows the whole site.",
        "Search engines are told not to crawl anything.",
        "Fix robots.txt immediately unless the site is intentionally private.",
      ),
    );
  } else {
    f.push(
      pass(
        "robots",
        "robots.txt in place",
        "Crawlers are allowed.",
        "Search engines can access the site.",
      ),
    );
  }
  if (!s.sitemap.found) {
    f.push(
      issue(
        "warn",
        "medium",
        "sitemap",
        "No XML sitemap found",
        "We couldn't find a sitemap.",
        "A sitemap helps search engines discover and re-crawl your important pages.",
        "Generate a sitemap and submit it in Google Search Console.",
      ),
    );
  } else {
    f.push(
      pass(
        "sitemap",
        "XML sitemap found",
        `A sitemap lists ${s.sitemap.urlCount ?? "some"} URLs.`,
        "It helps search engines find your pages.",
        s.sitemap.url,
      ),
    );
  }
  if (s.jsonLdTypes.length === 0) {
    f.push(
      issue(
        "warn",
        "medium",
        "schema",
        "No structured data",
        "The page has no structured data (schema.org).",
        "Structured data states facts about your business in a machine-readable way, used by Google rich results and AI systems.",
        "Add Organization (or LocalBusiness), WebSite and Service structured data with accurate details.",
      ),
    );
  } else {
    f.push(
      pass(
        "schema",
        "Structured data present",
        `Found: ${s.jsonLdTypes.join(", ")}.`,
        "Machines can read key facts about the page.",
        s.jsonLdTypes.join(", "),
      ),
    );
  }
  if (s.imageCount > 0) {
    const ratio = s.imagesMissingAlt / s.imageCount;
    if (ratio > 0.3) {
      f.push(
        issue(
          "warn",
          "medium",
          "alt",
          "Most images lack descriptive alt text",
          `${s.imagesMissingAlt} of ${s.imageCount} images have no meaningful alt text (or use a file name).`,
          "Alt text makes images understandable to search engines, AI and people using screen readers.",
          "Describe what each meaningful image shows; leave purely decorative images with empty alt text.",
        ),
      );
    } else {
      f.push(
        pass(
          "alt",
          "Images are described",
          `${s.imageCount - s.imagesMissingAlt} of ${s.imageCount} images have alt text.`,
          "Images are accessible and understandable to search.",
        ),
      );
    }
  }
  if (!s.openGraph.title || !s.openGraph.image) {
    f.push(
      issue(
        "warn",
        "low",
        "og",
        "Incomplete social sharing preview",
        "Open Graph title or image is missing.",
        "When your link is shared on LinkedIn or WhatsApp, the preview is what people see first.",
        "Add og:title, og:description and a branded og:image to each page.",
      ),
    );
  } else {
    f.push(
      pass(
        "og",
        "Social sharing preview set",
        "Links show a title and image when shared.",
        "Shared links look professional.",
      ),
    );
  }
  return f;
}

function contentFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  if (s.wordCount < 300) {
    f.push(
      issue(
        "fail",
        "high",
        "depth",
        "Very little written content",
        `The home page has about ${s.wordCount} words.`,
        "Search engines and AI systems need substance to understand what you do, who you serve and why you're credible.",
        "Explain your services, audience, process and proof in clear, specific language, and link to detailed service pages.",
      ),
    );
  } else if (s.wordCount < 600) {
    f.push(
      issue(
        "warn",
        "medium",
        "depth",
        "Content is fairly thin",
        `The home page has about ${s.wordCount} words.`,
        "Thin pages struggle to rank for anything beyond your brand name.",
        "Expand with specifics: services, industries served, locations, process and outcomes.",
      ),
    );
  } else {
    f.push(
      pass(
        "depth",
        "Substantial page content",
        `About ${s.wordCount} words of content.`,
        "There is enough substance for search engines to understand the page.",
      ),
    );
  }
  if (!s.blogPage) {
    f.push(
      issue(
        "warn",
        "medium",
        "blog",
        "No articles or insights section",
        "We found no blog, insights or resources section.",
        "Useful articles answer the questions buyers search for, and are one of the most dependable ways to earn search and AI visibility over time.",
        "Publish practical articles that answer real customer questions, starting with your most common sales questions.",
      ),
    );
  } else {
    f.push(
      pass(
        "blog",
        "Articles or insights published",
        "The site links to an articles/insights section.",
        "Ongoing content builds topical authority.",
      ),
    );
  }
  if (s.h2.length < 2) {
    f.push(
      issue(
        "warn",
        "low",
        "structure",
        "Little content structure",
        `Only ${s.h2.length} subheading(s) on the page.`,
        "Subheadings make pages scannable for people and understandable for machines.",
        "Break content into sections with descriptive H2 subheadings.",
      ),
    );
  }
  return f;
}

function aiFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  const org = s.organizationSchema;
  if (!org.name) {
    f.push(
      issue(
        "warn",
        "high",
        "entity",
        "Business identity isn't machine-readable",
        "There is no Organization or LocalBusiness structured data describing the company.",
        "AI assistants and search engines build a picture of your business as an 'entity'. Clear, consistent facts make it more likely you are understood and surfaced for relevant questions.",
        "Add Organization structured data with your legal name, logo, contact details, address and links to your official profiles (sameAs).",
      ),
    );
  } else if (org.sameAs.length === 0 || !org.logo) {
    f.push(
      issue(
        "warn",
        "medium",
        "entity",
        "Business identity is only partly described",
        `Organization data exists for "${org.name}" but lacks ${[org.sameAs.length === 0 ? "links to official profiles" : "", !org.logo ? "a logo" : ""].filter(Boolean).join(" and ")}.`,
        "Linking your official profiles helps systems confirm who you are.",
        "Complete the Organization data with logo and sameAs links (LinkedIn, Google Business Profile, etc.).",
      ),
    );
  } else {
    f.push(
      pass(
        "entity",
        "Business identity is machine-readable",
        `Organization data describes "${org.name}" with ${org.sameAs.length} official profile link(s).`,
        "It helps AI and search systems identify the business.",
      ),
    );
  }
  if (!s.aboutPage) {
    f.push(
      issue(
        "warn",
        "medium",
        "about",
        "No clear 'About' page",
        "We couldn't find an About or team page linked from the home page.",
        "Who is behind a business is a key trust and authority signal for both people and AI systems.",
        "Add an About page with the founder, experience, credentials and company facts.",
      ),
    );
  } else {
    f.push(
      pass(
        "about",
        "About page linked",
        "An About/team page is linked.",
        "It supports trust and authority.",
      ),
    );
  }
  f.push(
    s.llmsTxt
      ? pass(
          "llms",
          "llms.txt provided",
          "The site offers an llms.txt summary for AI tools.",
          "An emerging, optional convention for AI crawlers.",
        )
      : {
          key: "llms",
          status: "info",
          impact: "low",
          title: "No llms.txt (optional)",
          whatIsHappening: "The site has no llms.txt file.",
          whyItMatters:
            "llms.txt is an emerging, optional convention for giving AI tools a clean summary of your site. It is not a ranking factor and support varies.",
          whatToDo:
            "Optional: publish a short llms.txt that summarises your services and key pages.",
        },
  );
  f.push(
    notMeasured(
      "ai_answers",
      "Presence in AI answers",
      "Whether AI assistants mention you for your key questions isn't something a single page check can measure.",
      "It shows whether your visibility work reaches AI-driven discovery.",
      "Run a monitored AI visibility check on your priority questions (included in AI visibility services).",
    ),
  );
  return f;
}

function answerFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  const faqSchema = s.jsonLdTypes.includes("FAQPage");
  if (s.questionHeadings.length === 0) {
    f.push(
      issue(
        "warn",
        "high",
        "questions",
        "No questions answered on the page",
        "We found no question-style headings (e.g. 'How much does…?', 'How long does…?').",
        "Search engines and AI assistants increasingly answer questions directly. Pages that clearly answer common buyer questions are more likely to be used as the answer.",
        "List the 10 questions prospects ask most often and answer each clearly on the relevant page or an FAQ section.",
      ),
    );
  } else if (s.questionHeadings.length < 3) {
    f.push(
      issue(
        "warn",
        "medium",
        "questions",
        "Few questions answered",
        `Found ${s.questionHeadings.length} question-style heading(s).`,
        "More complete answers increase the chance of appearing for question searches.",
        "Expand the questions you answer, especially around cost, process, timelines and suitability.",
        s.questionHeadings.join(" · "),
      ),
    );
  } else {
    f.push(
      pass(
        "questions",
        "Answers common questions",
        `Found ${s.questionHeadings.length} question-style headings.`,
        "The page is structured to answer buyer questions.",
        s.questionHeadings.slice(0, 4).join(" · "),
      ),
    );
  }
  if (!faqSchema && s.questionHeadings.length >= 3) {
    f.push(
      issue(
        "warn",
        "low",
        "faq_schema",
        "Questions aren't marked up",
        "Question content exists but has no FAQ structured data.",
        "Structured FAQ data helps machines match questions to your answers.",
        "Add FAQPage structured data where the page genuinely is a list of questions and answers.",
      ),
    );
  } else if (faqSchema) {
    f.push(
      pass(
        "faq_schema",
        "FAQ structured data present",
        "FAQPage structured data is in place.",
        "Questions and answers are machine-readable.",
      ),
    );
  }
  return f;
}

function localFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  f.push(
    s.address
      ? pass(
          "address",
          "Business address visible",
          "An address or location details were found.",
          "Location information supports local search and trust.",
        )
      : issue(
          "warn",
          "medium",
          "address",
          "No clear business address",
          "We couldn't find a physical address or service area on the page.",
          "Local search and many B2B buyers look for a real, locatable business.",
          "Show your address or service area in the footer and contact page, consistent with your Google Business Profile.",
        ),
  );
  f.push(
    s.googleMaps
      ? pass(
          "maps",
          "Linked to Google Maps",
          "The site links to or embeds Google Maps.",
          "It connects the site to your Google presence.",
        )
      : issue(
          "warn",
          "low",
          "maps",
          "No link to your Google presence",
          "No Google Maps link or embed was found.",
          "Linking to your Google Business Profile reinforces that the site and the listing are the same business.",
          "Link to your Google Business Profile from the contact page.",
        ),
  );
  f.push(
    notMeasured(
      "gbp",
      "Google Business Profile",
      "We can't see your Google Business Profile details from your website alone.",
      "For many businesses the Google profile is the first thing people see.",
      "Share access or the profile link so we can review categories, services, photos and reviews.",
    ),
  );
  return f;
}

function socialFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  const linkedin = s.socialProfiles.linkedin;
  if (!linkedin) {
    f.push(
      issue(
        "warn",
        "high",
        "linkedin",
        "No LinkedIn link",
        "The website doesn't link to a LinkedIn page.",
        "For B2B businesses, LinkedIn is where buyers check who you are, and a key trust signal.",
        "Create or complete a LinkedIn company page and link it from the website.",
      ),
    );
  } else if (/linkedin\.com\/in\//.test(linkedin)) {
    f.push(
      issue(
        "warn",
        "medium",
        "linkedin",
        "LinkedIn link points to a personal profile",
        "The site links to a personal LinkedIn profile rather than a company page.",
        "A company page builds the business's own authority and followers, and is what buyers expect to find.",
        "Create a LinkedIn company page, link it from the site and from staff profiles.",
        linkedin,
      ),
    );
  } else {
    f.push(
      pass(
        "linkedin",
        "LinkedIn company page linked",
        "The site links to a LinkedIn page.",
        "Buyers can verify the business on LinkedIn.",
        linkedin,
      ),
    );
  }
  const others = Object.keys(s.socialProfiles).filter((k) => k !== "linkedin");
  if (others.length > 0) {
    f.push({
      key: "other_social",
      status: "info",
      impact: "low",
      title: "Other social profiles linked",
      whatIsHappening: `Linked profiles: ${others.join(", ")}.`,
      whyItMatters: "Consistent, active profiles support trust. Inactive ones can do the opposite.",
      whatToDo: "Keep linked profiles active, or remove links to profiles you don't maintain.",
    });
  }
  f.push(
    notMeasured(
      "linkedin_activity",
      "LinkedIn activity",
      "Posting frequency, follower growth and engagement aren't visible from your website.",
      "Consistent LinkedIn activity keeps you front of mind with buyers.",
      "Connect LinkedIn page analytics, or review activity manually.",
    ),
  );
  return f;
}

function conversionFindings(s: AuditSignals): Finding[] {
  const f: Finding[] = [];
  f.push(
    s.ctaTexts.length > 0
      ? pass(
          "cta",
          "Clear calls to action",
          `Found calls to action such as "${s.ctaTexts.slice(0, 3).join('", "')}".`,
          "Visitors know what to do next.",
        )
      : issue(
          "fail",
          "high",
          "cta",
          "No clear next step for visitors",
          "We found no clear call to action (e.g. 'Book a call', 'Request a quote').",
          "Visitors who are ready to talk need an obvious next step, or they leave.",
          "Add one primary call to action above the fold and repeat it at natural points down the page.",
        ),
  );
  f.push(
    s.forms > 0 || s.contactPage
      ? pass(
          "form",
          "Enquiry path available",
          s.forms > 0 ? "The page has an enquiry form." : "A contact page is linked.",
          "Visitors can reach you from the site.",
        )
      : issue(
          "warn",
          "high",
          "form",
          "No enquiry form or contact page",
          "No form or contact page was found from the home page.",
          "Every extra step between interest and enquiry loses prospects.",
          "Add a short enquiry form and a clearly linked contact page.",
        ),
  );
  if (s.phoneLinks === 0) {
    f.push(
      issue(
        "warn",
        "medium",
        "tel",
        "Phone number isn't tap-to-call",
        "No clickable phone (tel:) links were found.",
        "On mobile, a tap-to-call link turns interest into a conversation instantly.",
        "Make phone numbers clickable with tel: links.",
      ),
    );
  } else {
    f.push(
      pass(
        "tel",
        "Tap-to-call phone links",
        "Phone numbers are clickable.",
        "Mobile visitors can call in one tap.",
      ),
    );
  }
  if (s.caseStudyOrTestimonialSignals.length === 0) {
    f.push(
      issue(
        "warn",
        "medium",
        "trust",
        "Little visible proof",
        "We found no testimonials, case studies, reviews or client references.",
        "B2B buyers look for evidence you've solved similar problems before.",
        "Publish real, permissioned case studies and testimonials with specific outcomes.",
      ),
    );
  } else {
    f.push(
      pass(
        "trust",
        "Proof and trust signals present",
        `Found: ${s.caseStudyOrTestimonialSignals.join(", ")}.`,
        "Evidence reduces buyer risk.",
      ),
    );
  }
  if (s.analytics.length === 0) {
    f.push(
      issue(
        "warn",
        "high",
        "analytics",
        "No website analytics detected",
        "We couldn't detect Google Analytics, Tag Manager or similar tracking.",
        "Without measurement you can't tell which channels produce enquiries or whether changes work.",
        "Install Google Analytics 4 (with consent handling) and track enquiries as conversions.",
      ),
    );
  } else {
    f.push(
      pass(
        "analytics",
        "Analytics installed",
        `Detected: ${s.analytics.join(", ")}.`,
        "Visits and enquiries can be measured.",
      ),
    );
  }
  return f;
}

function competitorFindings(competitors: CompetitorComparison[]): Finding[] {
  if (competitors.length === 0) {
    return [
      notMeasured(
        "competitors",
        "Competitor comparison",
        "No competitors were included in this snapshot.",
        "Knowing what competitors do well shows where you can realistically win.",
        "Add two or three competitors to compare search, content, AI discoverability and conversion signals.",
      ),
    ];
  }
  return competitors.map((c) => ({
    key: `competitor_${c.name}`,
    status: c.considerations.length > 0 ? ("warn" as const) : ("info" as const),
    impact: "medium" as const,
    title: `Compared with ${c.name}`,
    whatIsHappening: c.highlights.join(" ") || "No clear differences found.",
    whyItMatters: "Competitors compete for the same searches, AI answers and buyer attention.",
    whatToDo: c.considerations.length
      ? `Consider: ${c.considerations.join("; ")}.`
      : "No action needed from this comparison.",
  }));
}

function categoryStatus(findings: Finding[]): CategoryStatus {
  const measured = findings.filter((f) => f.status !== "not_measured" && f.status !== "info");
  if (measured.length === 0) return "not_measured";
  if (measured.some((f) => f.status === "fail" && f.impact === "high")) return "critical";
  if (measured.some((f) => f.status === "fail" || f.status === "warn")) return "needs_attention";
  return "strong";
}

function categorySummary(status: CategoryStatus, findings: Finding[]): string {
  const issues = findings.filter((f) => f.status === "fail" || f.status === "warn");
  switch (status) {
    case "strong":
      return "In good shape. Keep it that way as the site evolves.";
    case "not_measured":
      return "Needs a connected data source or more information to assess.";
    case "critical":
      return `Needs attention first: ${issues.find((f) => f.status === "fail")?.title.toLowerCase()}.`;
    default:
      return `${issues.length} improvement${issues.length === 1 ? "" : "s"} identified.`;
  }
}

const IMPACT_RANK: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const EFFORT_BY_KEY: Record<string, AuditOpportunity["effort"]> = {
  title: "low",
  description: "low",
  h1: "low",
  canonical: "low",
  tel: "low",
  og: "low",
  lang: "low",
  favicon: "low",
  analytics: "low",
  schema: "low",
  entity: "low",
  sitemap: "low",
  robots: "low",
  depth: "medium",
  questions: "medium",
  blog: "high",
  trust: "medium",
  linkedin: "low",
  weight: "high",
};

export function toCompetitorComparison(
  name: string,
  url: string,
  own: AuditSignals,
  theirs: AuditSignals,
): CompetitorComparison {
  const highlights: string[] = [];
  const considerations: string[] = [];
  const compare = (label: string, ours: boolean, them: boolean, advice: string) => {
    if (them && !ours) {
      highlights.push(`${name} has ${label}; you don't.`);
      considerations.push(advice);
    } else if (ours && !them) {
      highlights.push(`You have ${label}; ${name} doesn't.`);
    }
  };
  compare(
    "structured business data",
    Boolean(own.organizationSchema.name),
    Boolean(theirs.organizationSchema.name),
    "describing your business with structured data",
  );
  compare(
    "an articles/insights section",
    own.blogPage,
    theirs.blogPage,
    "publishing useful articles on buyer questions",
  );
  compare(
    "question-and-answer content",
    own.questionHeadings.length >= 3,
    theirs.questionHeadings.length >= 3,
    "answering common buyer questions on your pages",
  );
  compare(
    "visible proof (testimonials/case studies)",
    own.caseStudyOrTestimonialSignals.length > 0,
    theirs.caseStudyOrTestimonialSignals.length > 0,
    "showing real case studies and testimonials",
  );
  compare(
    "a LinkedIn link",
    Boolean(own.socialProfiles.linkedin),
    Boolean(theirs.socialProfiles.linkedin),
    "linking an active LinkedIn company page",
  );
  if (theirs.wordCount > own.wordCount * 1.5 && theirs.wordCount > 500) {
    highlights.push(
      `${name}'s home page has much more content (about ${theirs.wordCount} vs ${own.wordCount} words).`,
    );
    considerations.push("explaining your services in more depth");
  }
  return { name, url, highlights, considerations };
}

/** Turns raw signals into the structured Visibility Report. Pure and deterministic. */
export function analyse(input: {
  url: string;
  signals: AuditSignals;
  competitors?: CompetitorComparison[];
  durationMs: number;
  fetchedAt?: Date;
}): AuditResult {
  const { signals } = input;
  const byCategory: Record<AuditCategoryKey, Finding[]> = {
    website: websiteFindings(signals),
    search: searchFindings(signals),
    technical: technicalFindings(signals),
    content: contentFindings(signals),
    ai_discoverability: aiFindings(signals),
    answer_readiness: answerFindings(signals),
    local: localFindings(signals),
    social: socialFindings(signals),
    conversion: conversionFindings(signals),
    competitors: competitorFindings(input.competitors ?? []),
  };

  const categories: AuditCategory[] = (Object.keys(byCategory) as AuditCategoryKey[]).map((key) => {
    const findings = byCategory[key];
    const status = categoryStatus(findings);
    return {
      key,
      label: AUDIT_CATEGORY_LABELS[key],
      status,
      summary: categorySummary(status, findings),
      findings: findings.map(({ key: findingKey, ...rest }) => ({
        id: `${key}.${findingKey}`,
        ...rest,
      })),
    };
  });

  const all = categories.flatMap((c) => c.findings.map((f) => ({ category: c.key, finding: f })));
  const issues = all
    .filter(({ finding }) => finding.status === "fail" || finding.status === "warn")
    .sort(
      (a, b) =>
        IMPACT_RANK[b.finding.impact] - IMPACT_RANK[a.finding.impact] ||
        (a.finding.status === "fail" ? -1 : 1),
    );

  const opportunities: AuditOpportunity[] = [];
  const seenCategories = new Map<AuditCategoryKey, number>();
  for (const { category, finding } of issues) {
    if ((seenCategories.get(category) ?? 0) >= 2) continue;
    seenCategories.set(category, (seenCategories.get(category) ?? 0) + 1);
    opportunities.push({
      title: finding.whatToDo.split(/(?<=\.)\s/)[0],
      category,
      impact: finding.impact,
      effort: EFFORT_BY_KEY[finding.id.split(".")[1]] ?? "medium",
      description: `${finding.whatIsHappening} ${finding.whyItMatters}`,
      serviceSlug: CATEGORY_SERVICE[category],
    });
    if (opportunities.length >= 7) break;
  }

  const counts = {
    strengths: all.filter(({ finding }) => finding.status === "pass").length,
    improvements: all.filter(({ finding }) => finding.status === "warn").length,
    critical: all.filter(({ finding }) => finding.status === "fail").length,
    notMeasured: all.filter(({ finding }) => finding.status === "not_measured").length,
  };
  const weight = (c: AuditCategory) =>
    c.findings.reduce(
      (sum, f) =>
        sum + (f.status === "fail" ? 2 : f.status === "warn" ? 1 : 0) * IMPACT_RANK[f.impact],
      0,
    );
  const weakest = categories
    .filter((c) => c.status === "critical" || c.status === "needs_attention")
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, 2);
  const headline =
    counts.critical + counts.improvements === 0
      ? "Your visibility foundations are in good shape. The next gains come from content, authority and measurement."
      : `We found ${counts.strengths} strengths and ${counts.critical + counts.improvements} things to improve.${weakest.length ? ` The biggest opportunities are in ${weakest.map((c) => c.label.toLowerCase()).join(" and ")}.` : ""}`;

  return {
    version: 1,
    url: input.url,
    finalUrl: signals.finalUrl,
    fetchedAt: (input.fetchedAt ?? new Date()).toISOString(),
    durationMs: input.durationMs,
    headline,
    counts,
    categories,
    opportunities,
    competitors: input.competitors ?? [],
    signals,
    limitations: [
      "This is an initial visibility snapshot based on publicly available pages, not a full SEO audit.",
      "Search rankings, traffic and AI answer presence require connected data (e.g. Google Search Console) to measure.",
      "Automated checks can miss context. Findings are reviewed by a person before any work is recommended.",
    ],
  };
}
