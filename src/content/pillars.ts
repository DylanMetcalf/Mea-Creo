/**
 * Website copy for the four service pillars. Plain, specific, no guarantees.
 * Edit here to change the public service pages. The service catalogue that drives
 * proposals and billing lives in the database (Workspace → Services).
 */
export interface Pillar {
  slug: "visibility" | "growth" | "automation" | "creative";
  name: string;
  tagline: string;
  headline: string;
  intro: string;
  metaDescription: string;
  outcomes: string[];
  services: { name: string; description: string; points: string[] }[];
  faq: { question: string; answer: string }[];
  honesty: string;
}

export const PILLARS: Pillar[] = [
  {
    slug: "visibility",
    name: "Visibility",
    tagline: "Get found",
    headline: "Be found on Google, and understood by AI search.",
    intro:
      "Your buyers research before they call. Visibility work makes sure that when they search, or ask an AI assistant, they find a clear, credible answer that points to you.",
    metaDescription:
      "SEO, GEO, AEO and AI search visibility for B2B and professional service businesses in South Africa and internationally.",
    outcomes: [
      "More relevant search visibility",
      "Clear, consistent business information across the web",
      "Content that answers what buyers actually ask",
      "Measured progress, reported monthly",
    ],
    services: [
      {
        name: "SEO",
        description:
          "Technical health, relevance and authority, so search engines can find, understand and rank your pages.",
        points: [
          "Technical and indexing fixes",
          "Keyword and search-intent research",
          "Service page optimisation",
          "Internal linking and metadata",
          "Search Console monitoring",
        ],
      },
      {
        name: "GEO: AI search visibility",
        description:
          "Generative engine optimisation makes your business easy for AI systems to understand as an entity: who you are, what you do, where and for whom.",
        points: [
          "Consistent company facts across the web",
          "Organization and Service structured data",
          "Authoritative, citable content",
          "Spot checks on priority questions",
        ],
      },
      {
        name: "AEO: answer engine optimisation",
        description:
          "Clear answers to the questions buyers ask, structured so search engines and assistants can use them.",
        points: [
          "Question research from sales conversations and search",
          "FAQ and answer-first content",
          "FAQ structured data where genuine",
          "Answer-format improvements",
        ],
      },
      {
        name: "Google & local visibility",
        description:
          "A complete, accurate Google Business Profile and consistent listings where your customers look.",
        points: ["Profile optimisation", "Listing consistency", "Review request process"],
      },
      {
        name: "Website optimisation",
        description:
          "Speed, mobile experience, structure and conversion paths, so visibility turns into enquiries.",
        points: ["Speed and Core Web Vitals", "Site structure", "Conversion paths"],
      },
    ],
    faq: [
      {
        question: "What is the difference between SEO, GEO and AEO?",
        answer:
          "SEO helps search engines find, understand and rank your site. AEO focuses on answering buyers' questions clearly so your content can be used as the answer. GEO makes your business easy for AI systems to understand and reference. In practice they reinforce each other.",
      },
      {
        question: "Can you guarantee first-page rankings or AI mentions?",
        answer:
          "No, and you should be wary of anyone who does. Search engines and AI assistants are run by third parties. What we do is identify, execute, measure and keep improving the work that makes visibility more likely, and show you the evidence each month.",
      },
      {
        question: "How long does SEO take to show results?",
        answer:
          "Technical fixes and page improvements can show early movement within weeks. Meaningful, compounding visibility usually builds over three to six months, depending on competition and starting point.",
      },
    ],
    honesty:
      "We never promise guaranteed rankings or AI citations. We promise active work, clear measurement and honest reporting.",
  },
  {
    slug: "growth",
    name: "Growth",
    tagline: "Get opportunities",
    headline: "Turn visibility into real conversations.",
    intro:
      "Being found is the start. Growth work brings the right decision makers to you, and takes your message to them, with every external message approved by a person.",
    metaDescription:
      "Lead generation, Google Ads, LinkedIn networking and conversion optimisation for B2B businesses.",
    outcomes: [
      "A qualified pipeline of relevant prospects",
      "Personal, compliant outreach",
      "More enquiries from existing traffic",
      "Clear view of what produces meetings",
    ],
    services: [
      {
        name: "Lead generation",
        description:
          "We research companies that match your ideal customer, explain why each could need you, and prepare outreach for your approval.",
        points: [
          "Ideal-customer definition",
          "Prospect research",
          "Personalised outreach drafts",
          "Follow-up tracking",
        ],
      },
      {
        name: "LinkedIn networking",
        description:
          "A structured plan for connecting with the right decision makers, with message drafts written for you. You stay in control of every LinkedIn action.",
        points: [
          "Target lists with reasons to connect",
          "Message and follow-up drafts",
          "Profile advice",
        ],
      },
      {
        name: "Google Ads",
        description:
          "Search advertising built around enquiries, not clicks. Budget changes always need your approval.",
        points: ["Campaign strategy and build", "Conversion tracking", "Ongoing optimisation"],
      },
      {
        name: "Conversion optimisation",
        description:
          "Clearer calls to action, better forms and focused landing pages, so more visitors become enquiries.",
        points: ["Conversion audit", "CTA and form improvements", "Landing pages"],
      },
    ],
    faq: [
      {
        question: "Do you send automated LinkedIn messages?",
        answer:
          "No. We don't automate personal LinkedIn actions against the platform's rules. We prepare the list, the reason to connect and the message; a person sends it.",
      },
      {
        question: "Will you email people without our approval?",
        answer:
          "No. Outreach messages are approved before sending, sent at sensible volumes, and respect consent and unsubscribe requirements.",
      },
    ],
    honesty:
      "No bulk spam and no platform workarounds. Just well-researched, personal outreach that you approve.",
  },
  {
    slug: "automation",
    name: "Automation",
    tagline: "Get automated",
    headline: "Remove repetitive work. Keep people on what matters.",
    intro:
      "We design practical automations and AI agents that take repetitive work off your team, with human checkpoints wherever customers, money or commitments are involved.",
    metaDescription:
      "AI agents, workflow automation, business systems and reporting automation for service businesses.",
    outcomes: [
      "Hours back every week",
      "Faster, more consistent follow-up",
      "Reports that assemble themselves",
      "Clear control over what runs automatically",
    ],
    services: [
      {
        name: "AI agents & workflow automation",
        description:
          "Enquiry handling, follow-ups, document processing and internal workflows, designed with approval steps built in.",
        points: [
          "Process mapping",
          "Automation design and build",
          "Human-in-the-loop checkpoints",
          "Documentation and handover",
        ],
      },
      {
        name: "Reporting automation",
        description:
          "Monthly business reports that pull from your systems and explain what happened and what to do next.",
        points: ["Data connections", "Report design", "Monthly generation and review"],
      },
      {
        name: "Automation consulting",
        description:
          "A structured review of your operations to find where automation will genuinely pay off, sized and prioritised.",
        points: ["Discovery workshop", "Opportunity sizing", "Roadmap"],
      },
    ],
    faq: [
      {
        question: "Will automation replace our staff?",
        answer:
          "That isn't the aim. Automation removes repetitive work so your people can spend more time on customers, judgement and growth.",
      },
      {
        question: "How do you keep AI safe?",
        answer:
          "Each automation has a clear level: suggest, prepare for approval, or act automatically. Anything client-facing, financial or contractual starts with human approval.",
      },
    ],
    honesty:
      "We automate what is safe to automate, and keep a person in charge of everything else.",
  },
  {
    slug: "creative",
    name: "Creative",
    tagline: "Get noticed",
    headline: "Once they find you, give them something worth seeing.",
    intro:
      "Visibility gets you considered. Credible imagery, video and content get you chosen. Our creative work supports your website, proposals, LinkedIn and campaigns.",
    metaDescription:
      "Photography, videography, graphic design, content creation and social media for B2B brands.",
    outcomes: [
      "Authentic imagery of your people and work",
      "Content that supports search and sales",
      "Consistent, professional brand presentation",
    ],
    services: [
      {
        name: "Photography",
        description: "Your people, premises, products and work on site, captured professionally.",
        points: ["Shoot planning", "On-site photography", "Web-ready delivery"],
      },
      {
        name: "Videography",
        description: "Short videos that explain what you do and why it matters.",
        points: ["Scripting", "Filming and editing", "Formats for web and social"],
      },
      {
        name: "Graphic design",
        description: "Sales documents, presentations, social graphics and campaign creative.",
        points: ["Brand-consistent design", "Print and digital"],
      },
      {
        name: "Content creation",
        description:
          "Articles, service pages and LinkedIn content planned around what buyers search for.",
        points: ["Content planning", "Writing and design", "Approval workflow"],
      },
      {
        name: "Social media",
        description: "Consistent, credible presence, LinkedIn first for B2B.",
        points: ["Content calendar", "Scheduling", "Community management"],
      },
    ],
    faq: [
      {
        question: "Can we book creative work on its own?",
        answer:
          "Yes. Photography, video and design are available as one-off projects, as well as part of a wider visibility programme.",
      },
    ],
    honesty:
      "Creative work is planned around where it will be used, so it earns its place on your website, in proposals and in campaigns.",
  },
];

export const HOW_IT_WORKS = [
  {
    name: "Discover",
    description: "We learn how your business wins work: your services, buyers, margins and goals.",
  },
  {
    name: "Audit",
    description:
      "We assess your visibility across search, AI discovery, your website, content and conversion.",
  },
  {
    name: "Strategise",
    description: "We decide what's actually worth doing, in what order, and how we'll measure it.",
  },
  {
    name: "Implement",
    description: "Mea Creo and our systems do the work, with your approval where it matters.",
  },
  {
    name: "Measure",
    description:
      "We track what changed: visibility, enquiries and opportunities, not vanity metrics.",
  },
  {
    name: "Improve",
    description: "Every month we review, learn and adjust. Visibility is a system, not a project.",
  },
];

export function getPillar(slug: string): Pillar | undefined {
  return PILLARS.find((p) => p.slug === slug);
}
