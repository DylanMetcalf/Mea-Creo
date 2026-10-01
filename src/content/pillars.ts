/**
 * Website copy for the four service pillars. Plain, specific, no guarantees.
 * Edit here to change the public service pages. The service catalogue that drives
 * proposals and billing lives in the database (Workspace → Services).
 */
export interface Pillar {
  slug: "visibility" | "growth" | "content" | "technology" | "consulting" | "quality-assurance";
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
      "Lead generation, conversion optimisation, content and LinkedIn strategy, and campaign strategy for B2B and technical businesses.",
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
        name: "Content, campaign and marketing strategy",
        description:
          "What to say, to whom, where and in what order, grounded in how your buyers actually think and decide.",
        points: [
          "Audience and positioning work",
          "Content strategy",
          "Campaign planning (including search ads where they fit)",
          "Monthly strategy review",
        ],
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
    slug: "technology",
    name: "Technology",
    tagline: "Get systemised",
    headline: "Websites, AI and systems that do the work behind the scenes.",
    intro:
      "Visibility only pays off if the business behind it can respond. We build websites, automations, CRM workflows, dashboards, portals and AI agents, with human checkpoints wherever customers, money or commitments are involved.",
    metaDescription:
      "Website development, AI systems, business automation, CRM and workflow systems, dashboards and client portals for growing businesses.",
    outcomes: [
      "A website that explains, convinces and converts",
      "Faster, more consistent follow-up on every lead",
      "Hours back every week from repetitive work",
      "Clear control over what runs automatically",
    ],
    services: [
      {
        name: "Website development",
        description:
          "Fast, search-ready websites that make it obvious what you do, who it's for and what to do next.",
        points: [
          "Structure and copy",
          "Design and build",
          "Search and AI readiness",
          "Analytics and tracking",
        ],
      },
      {
        name: "AI systems & business automation",
        description:
          "Enquiry handling, follow-ups, document processing and internal workflows, designed with approval steps built in.",
        points: [
          "Process mapping",
          "Automation design and build",
          "AI agents with human-in-the-loop checkpoints",
          "Documentation and handover",
        ],
      },
      {
        name: "CRM, lead-generation and workflow systems",
        description:
          "Lead capture, routing, follow-up and pipeline tracking that make sure no enquiry is lost.",
        points: [
          "Lead capture and routing",
          "CRM setup and workflows",
          "Integrations between your tools",
        ],
      },
      {
        name: "Dashboards, portals and internal applications",
        description:
          "Reporting dashboards, client portals and internal tools that turn scattered information into clear next actions.",
        points: [
          "Data connections",
          "Dashboard and portal design",
          "Internal business applications",
        ],
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
    slug: "content",
    name: "Content",
    tagline: "Get noticed",
    headline: "Content that makes people proud to show your business.",
    intro:
      "Visibility gets you considered. Credible photography, video, design and writing get you chosen. Our content work supports your website, proposals, LinkedIn and campaigns, and it's planned around how your buyers think.",
    metaDescription:
      "Photography, videography, graphic design and content creation for B2B, industrial and professional service businesses.",
    outcomes: [
      "Authentic imagery of your people, products and work",
      "Content that supports search, sales and campaigns",
      "Consistent, professional brand presentation",
    ],
    services: [
      {
        name: "Brand and content shoots",
        description:
          "Your people, premises, products and work on site, captured professionally: photography and video planned around where it will be used.",
        points: [
          "Shoot planning",
          "On-site photography and video",
          "Web, social and print delivery",
        ],
      },
      {
        name: "Graphic design",
        description: "Sales documents, presentations, social graphics and campaign creative.",
        points: ["Brand-consistent design", "Print and digital"],
      },
      {
        name: "Content creation",
        description:
          "Articles, service pages, corporate and product content, and LinkedIn posts planned around what buyers search for and ask.",
        points: ["Content planning", "Writing and design", "Approval workflow"],
      },
      {
        name: "Social content",
        description: "A consistent, credible presence, LinkedIn first for B2B.",
        points: ["Content calendar", "Creation", "Scheduling"],
      },
    ],
    faq: [
      {
        question: "Can we book photography or video on its own?",
        answer:
          "Yes. Photography, video and design are available as projects, as well as part of a wider visibility and growth programme.",
      },
    ],
    honesty:
      "Content is a supporting capability: it's planned around where it will be used, so it earns its place on your website, in proposals and in campaigns.",
  },
  {
    slug: "consulting",
    name: "Consulting",
    tagline: "Get clarity",
    headline: "Strategy for visibility, growth and AI, from someone who does the work.",
    intro:
      "Sometimes the most valuable thing is a clear plan. We help you decide what to do, in what order, and what to leave alone, across digital strategy, marketing, visibility and AI.",
    metaDescription:
      "Digital strategy, marketing strategy, visibility consulting, AI and business consulting, and growth consulting.",
    outcomes: [
      "A clear, prioritised roadmap",
      "Decisions grounded in data and in how buyers actually think",
      "Confidence about where to invest, and where not to",
    ],
    services: [
      {
        name: "Digital and marketing strategy",
        description:
          "Positioning, messaging, channels and priorities, combining data with psychology, creativity and business strategy.",
        points: ["Discovery workshop", "Positioning and messaging", "Channel and content plan"],
      },
      {
        name: "Visibility consulting",
        description:
          "An outside view of how you're found, understood and chosen, with a practical plan.",
        points: ["Visibility assessment", "Competitor view", "Prioritised recommendations"],
      },
      {
        name: "AI and business consulting",
        description:
          "Where AI and automation will genuinely pay off in your business, and how to adopt them safely.",
        points: ["AI readiness review", "Automation opportunities", "Implementation roadmap"],
      },
    ],
    faq: [
      {
        question: "Do you only advise, or also implement?",
        answer:
          "Both. Many clients start with a strategy engagement and then have Mea Creo implement it, but the plan is yours either way.",
      },
    ],
    honesty: "We'll tell you when something isn't worth doing, even if it's something we sell.",
  },
  {
    slug: "quality-assurance",
    name: "Quality Assurance",
    tagline: "Get it right",
    headline: "An independent quality check before anything goes out.",
    intro:
      "Your team produces content. We make sure it's accurate, on-brand, search-ready and compliant before it's published, with a clear checklist and a documented approve-or-revise decision.",
    metaDescription:
      "Independent content quality assurance: brand compliance, accuracy, visual, messaging, SEO and search-readiness review with a final approval workflow.",
    outcomes: [
      "Consistent brand and messaging across everything you publish",
      "Fewer errors reaching customers",
      "Content that's ready for search and AI from day one",
      "A clear record of what was checked and approved",
    ],
    services: [
      {
        name: "Content QA",
        description:
          "Every piece reviewed against a checklist you agree: brand, accuracy, spelling, visuals, messaging, calls to action and compliance.",
        points: [
          "Brand compliance and messaging review",
          "Accuracy, spelling and visual review",
          "SEO, GEO and AEO readiness review",
          "Approve or revise, with clear notes",
        ],
      },
      {
        name: "Final approval workflow",
        description:
          "A structured path from draft to internal review, QA, client review and publication, with a record at every step.",
        points: ["Configurable checklists", "Approval tracking", "Monthly quality summary"],
      },
    ],
    faq: [
      {
        question: "Can you QA content we produce in-house or with another agency?",
        answer:
          "Yes. That's exactly what the service is for. We work from your brand guidelines and requirements.",
      },
    ],
    honesty: "QA reduces risk; it doesn't replace your own sign-off on legal or technical claims.",
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
