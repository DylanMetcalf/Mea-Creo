import type {
  ApprovalLevel,
  AutomationLevel,
  BillingType,
  ServiceCategory,
  ServicePrices,
} from "@/db/schema";

/**
 * The initial Mea Creo service catalogue, seeded into the `services` table.
 * After seeding, the database is the source of truth and everything here is
 * editable in Workspace → Services. Only the approved package prices from the Master Build
 * handoff are defined here (Foundation, Visibility, Growth, Scale). Individual services have
 * no price until the owner sets one; demo mode adds clearly-labelled demo prices.
 */
export interface CatalogueService {
  slug: string;
  name: string;
  category: ServiceCategory;
  billingType: BillingType;
  summary: string;
  description: string;
  includedActivities: string[];
  deliverables: string[];
  kpis: string[];
  requiredInputs: string[];
  requiredIntegrations: string[];
  agents: string[];
  runKinds: string[];
  automationLevel: AutomationLevel;
  humanInvolvement: string;
  defaultApprovalLevel: ApprovalLevel;
  selfService?: boolean;
  requiresStrategy?: boolean;
  /** Approved prices only (integer minor units). Never invent a price. */
  prices?: ServicePrices;
}

const zar = (p: {
  setupMinor?: number;
  monthlyMinor?: number;
  oneOffMinor?: number;
}): ServicePrices => ({ ZAR: p });

type Productised = Pick<
  CatalogueService,
  "slug" | "name" | "summary" | "description" | "includedActivities" | "deliverables"
> &
  Partial<CatalogueService>;

/** Repeatable, productised offers share defaults. */
function productised(category: ServiceCategory, p: Productised): CatalogueService {
  return {
    category,
    billingType: "on_request",
    kpis: [],
    requiredInputs: ["Website address", "A short conversation about goals"],
    requiredIntegrations: [],
    agents: ["research", "visibility", "quality_control"],
    runKinds: [],
    automationLevel: "assisted",
    humanInvolvement:
      "Prepared with Mea Creo's audit engine and reviewed by Dylan before delivery.",
    defaultApprovalLevel: "internal",
    requiresStrategy: false,
    ...p,
  };
}

const ALL_VISIBILITY_RUNS = [
  "visibility_audit",
  "seo_analysis",
  "ai_visibility_analysis",
  "competitor_analysis",
  "website_conversion_audit",
  "content_opportunity_scan",
  "monthly_client_review",
];

export const SERVICE_CATALOGUE: CatalogueService[] = [
  // ---------------------------------------------------------------- Packages (approved pricing)
  {
    slug: "package-foundation",
    name: "Foundation",
    category: "package",
    billingType: "once_off",
    summary: "A complete visibility and growth assessment with a strategic roadmap.",
    description:
      "The starting point for most clients: where you stand, why, and exactly what to do next, across your website, search, Google, competitors, conversion and lead generation.",
    includedActivities: [
      "Digital visibility audit",
      "Website assessment",
      "Search and Google assessment",
      "Competitor assessment",
      "SEO baseline",
      "GEO and AEO baseline",
      "Conversion assessment",
      "Lead-generation assessment",
      "Strategic roadmap",
    ],
    deliverables: ["Foundation report", "Prioritised strategic roadmap", "Walk-through meeting"],
    kpis: ["Baseline visibility", "Baseline enquiries"],
    requiredInputs: [
      "Website address",
      "Google Search Console and Analytics access (recommended)",
      "Goals conversation",
    ],
    requiredIntegrations: ["search", "analytics"],
    agents: ["research", "visibility", "strategy", "quality_control"],
    runKinds: [
      "visibility_audit",
      "seo_analysis",
      "ai_visibility_analysis",
      "competitor_analysis",
      "website_conversion_audit",
    ],
    automationLevel: "assisted",
    humanInvolvement:
      "Analysis assisted by the audit engine; findings, roadmap and walk-through by Dylan.",
    defaultApprovalLevel: "internal",
    requiresStrategy: false,
    prices: zar({ oneOffMinor: 750_000 }),
  },
  {
    slug: "package-visibility",
    name: "Visibility",
    category: "package",
    billingType: "monthly",
    summary: "Be found on Google and understood by AI search, month after month.",
    description:
      "Ongoing search visibility: SEO, GEO and AEO, website optimisation, Google visibility, search content, monitoring and monthly reporting with strategic recommendations.",
    includedActivities: [
      "SEO and search visibility",
      "GEO and AEO",
      "Website optimisation",
      "Google visibility",
      "Search content",
      "Monthly optimisation",
      "Visibility monitoring",
      "Monthly reporting",
      "Strategic recommendations",
    ],
    deliverables: ["Monthly optimisation work", "Monthly report", "Recommendations for next month"],
    kpis: [
      "Organic impressions and clicks",
      "Visibility for priority searches",
      "Organic enquiries",
    ],
    requiredInputs: [
      "Website access or a developer contact",
      "Search Console and Analytics access",
      "Priority services and locations",
    ],
    requiredIntegrations: ["search", "analytics"],
    agents: ["visibility", "research", "content", "reporting", "quality_control"],
    runKinds: ALL_VISIBILITY_RUNS,
    automationLevel: "assisted",
    humanInvolvement: "Strategy, prioritisation and approval of changes by Mea Creo.",
    defaultApprovalLevel: "client",
    prices: zar({ monthlyMinor: 850_000 }),
  },
  {
    slug: "package-growth",
    name: "Growth",
    category: "package",
    billingType: "monthly",
    summary: "Everything in Visibility, plus content, lead generation and conversion.",
    description:
      "Visibility plus the work that turns it into pipeline: content strategy and ongoing content, lead generation and capture, conversion optimisation, LinkedIn and content strategy, competitor monitoring, marketing automation and AI-assisted workflows, with a monthly strategy review.",
    includedActivities: [
      "Everything in Visibility",
      "Content strategy and ongoing content",
      "Lead generation and lead capture",
      "Conversion optimisation",
      "LinkedIn and content strategy",
      "Competitor monitoring",
      "Marketing automation and AI-assisted workflows",
      "Monthly strategy review",
    ],
    deliverables: [
      "Monthly content",
      "Qualified prospect research and approved outreach",
      "Monthly report and strategy review",
    ],
    kpis: ["Enquiries", "Meetings booked", "Conversion rate", "Organic visibility"],
    requiredInputs: [
      "Everything for Visibility",
      "Ideal customer profile",
      "Sales process overview",
    ],
    requiredIntegrations: ["search", "analytics", "email"],
    agents: [
      "visibility",
      "research",
      "content",
      "lead",
      "outreach",
      "reporting",
      "quality_control",
    ],
    runKinds: [
      ...ALL_VISIBILITY_RUNS,
      "lead_opportunity_scan",
      "linkedin_opportunity_scan",
      "client_growth_review",
    ],
    automationLevel: "assisted",
    humanInvolvement: "Strategy, content and every outreach message approved by a person.",
    defaultApprovalLevel: "client",
    prices: zar({ monthlyMinor: 1_250_000 }),
  },
  {
    slug: "package-scale",
    name: "Scale",
    category: "package",
    billingType: "monthly",
    summary: "Everything in Growth, plus advanced search, lead systems, CRM and AI automation.",
    description:
      "For businesses ready to systemise growth: advanced SEO, GEO and AEO, lead-generation systems, CRM workflows, AI automation, reporting dashboards, content systems, campaign support, strategic consulting and priority support.",
    includedActivities: [
      "Everything in Growth",
      "Advanced SEO, GEO and AEO",
      "Lead-generation systems",
      "CRM workflows",
      "AI automation",
      "Reporting dashboard",
      "Content systems",
      "Campaign support",
      "Strategic consulting",
      "Priority support",
    ],
    deliverables: [
      "Lead and CRM systems",
      "Reporting dashboard",
      "Monthly strategy session",
      "Priority support",
    ],
    kpis: ["Pipeline value", "Meetings booked", "Cost per enquiry", "Hours saved by automation"],
    requiredInputs: ["Everything for Growth", "CRM and system access"],
    requiredIntegrations: ["search", "analytics", "email", "crm"],
    agents: [
      "visibility",
      "research",
      "content",
      "lead",
      "outreach",
      "operations",
      "reporting",
      "strategy",
      "quality_control",
    ],
    runKinds: [
      ...ALL_VISIBILITY_RUNS,
      "lead_opportunity_scan",
      "linkedin_opportunity_scan",
      "client_growth_review",
    ],
    automationLevel: "assisted",
    humanInvolvement: "Dedicated strategy with Dylan; automation with approval checkpoints.",
    defaultApprovalLevel: "client",
    prices: zar({ monthlyMinor: 1_850_000 }),
  },
  {
    slug: "package-custom",
    name: "Custom",
    category: "package",
    billingType: "on_request",
    summary: "A scoped quotation for larger or more complex requirements.",
    description:
      "For large websites, complex automation, large SEO programmes, multiple locations, large content requirements, complex CRM, custom software, extensive campaigns or enterprise requirements.",
    includedActivities: ["Scoping conversation", "Custom proposal"],
    deliverables: ["Custom proposal and quotation"],
    kpis: [],
    requiredInputs: ["Requirements conversation"],
    requiredIntegrations: [],
    agents: ["research", "proposal"],
    runKinds: ["visibility_audit"],
    automationLevel: "manual",
    humanInvolvement: "Scoped and quoted by Dylan.",
    defaultApprovalLevel: "internal",
  },
  // ---------------------------------------------------------------- Visibility
  {
    slug: "seo",
    name: "SEO",
    category: "visibility",
    billingType: "monthly",
    summary: "Make your website easier for search engines to find, understand and rank.",
    description:
      "Ongoing search engine optimisation: technical health, keyword and intent research, on-page improvements, internal linking and content priorities, measured through Search Console.",
    includedActivities: [
      "Monthly technical health check",
      "Keyword and search-intent research",
      "On-page optimisation of priority pages",
      "Metadata and internal-linking improvements",
      "Content priorities for the month",
      "Search Console monitoring",
    ],
    deliverables: ["Monthly SEO recommendations", "Implemented on-page changes", "Monthly report"],
    kpis: [
      "Organic impressions",
      "Organic clicks",
      "Average position for priority queries",
      "Organic enquiries",
    ],
    requiredInputs: ["Website access or a developer contact", "Priority services and locations"],
    requiredIntegrations: ["search", "analytics"],
    agents: ["seo", "research", "reporting", "quality_control"],
    runKinds: ["seo_analysis", "content_opportunity_scan", "monthly_client_review"],
    automationLevel: "assisted",
    humanInvolvement: "Strategy, prioritisation and approval of changes by a Mea Creo specialist.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "geo",
    name: "GEO (AI search visibility)",
    category: "visibility",
    billingType: "monthly",
    summary: "Help AI assistants and AI search understand who you are and what you do.",
    description:
      "Generative engine optimisation: clear entity information, consistent business facts across the web, structured data and authoritative content that AI systems can understand and reference. We improve the likelihood of being surfaced; nobody controls AI answers directly.",
    includedActivities: [
      "Entity and brand consistency review",
      "Structured data (Organization, Service, FAQ) improvements",
      "Authoritative, citable content recommendations",
      "AI search spot-checks for priority questions",
    ],
    deliverables: ["AI visibility findings", "Structured data changes", "Content recommendations"],
    kpis: ["Coverage of priority questions", "Entity consistency", "Structured data coverage"],
    requiredInputs: ["Approved company facts", "Priority questions customers ask"],
    requiredIntegrations: [],
    agents: ["visibility", "research", "quality_control"],
    runKinds: ["ai_visibility_analysis"],
    automationLevel: "assisted",
    humanInvolvement: "Specialist review of every recommendation before it reaches the client.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "aeo",
    name: "AEO (answer engine optimisation)",
    category: "visibility",
    billingType: "monthly",
    summary: "Answer the questions your buyers ask, in a form search and AI can use.",
    description:
      "Identifies the questions prospects ask, then structures clear, authoritative answers on your site (FAQ, how-to and comparison content) so you are positioned for featured snippets, voice and AI answers.",
    includedActivities: [
      "Question research",
      "FAQ and answer content briefs",
      "FAQPage schema where genuine",
      "Answer-format optimisation",
    ],
    deliverables: ["Question map", "Answer content briefs", "Implemented FAQ content"],
    kpis: ["Questions covered", "Featured snippet appearances", "Impressions on question queries"],
    requiredInputs: ["Sales and support FAQs"],
    requiredIntegrations: ["search"],
    agents: ["visibility", "content", "quality_control"],
    runKinds: ["ai_visibility_analysis", "content_opportunity_scan"],
    automationLevel: "assisted",
    humanInvolvement: "Content approved by the client before publishing.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "technical-seo",
    name: "Technical SEO & website optimisation",
    category: "visibility",
    billingType: "once_off",
    summary: "Fix the technical issues that stop your site being crawled, indexed and trusted.",
    description:
      "A technical project covering indexing, crawlability, speed, mobile usability, structured data, redirects and site architecture.",
    includedActivities: [
      "Technical audit",
      "Indexing and crawl fixes",
      "Speed improvements",
      "Structured data",
      "Redirect clean-up",
    ],
    deliverables: [
      "Technical audit report",
      "Prioritised fix list",
      "Implemented fixes (where access allows)",
    ],
    kpis: ["Indexed pages", "Core Web Vitals", "Crawl errors"],
    requiredInputs: ["Website/CMS access"],
    requiredIntegrations: ["search"],
    agents: ["seo", "quality_control"],
    runKinds: ["visibility_audit", "website_conversion_audit"],
    automationLevel: "assisted",
    humanInvolvement: "Changes implemented or reviewed by a specialist.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "local-google-visibility",
    name: "Google & local visibility",
    category: "visibility",
    billingType: "monthly",
    summary: "Show up properly on Google Search and Maps where your customers look.",
    description:
      "Google Business Profile optimisation, consistent business listings, reviews process and local landing pages where relevant.",
    includedActivities: [
      "Google Business Profile optimisation",
      "Listing consistency",
      "Review request process",
      "Local page recommendations",
    ],
    deliverables: ["Optimised profile", "Listing audit", "Monthly update"],
    kpis: ["Profile views", "Calls and direction requests", "Review count and rating"],
    requiredInputs: ["Google Business Profile access"],
    requiredIntegrations: [],
    agents: ["seo"],
    runKinds: ["visibility_audit"],
    automationLevel: "manual",
    humanInvolvement: "Profile updates made by Mea Creo with client approval.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "visibility-monitoring",
    name: "Visibility monitoring",
    category: "visibility",
    billingType: "monthly",
    summary: "A monthly check on your search, AI and website visibility, with clear next steps.",
    description:
      "Automated monthly visibility snapshot with a short human-reviewed summary of changes and opportunities.",
    includedActivities: ["Monthly visibility snapshot", "Change detection", "Opportunity summary"],
    deliverables: ["Monthly visibility summary"],
    kpis: ["Findings resolved", "New opportunities identified"],
    requiredInputs: ["Website URL"],
    requiredIntegrations: [],
    agents: ["visibility", "reporting"],
    runKinds: ["visibility_audit", "monthly_client_review"],
    automationLevel: "automated",
    humanInvolvement: "Summary reviewed before it is sent.",
    defaultApprovalLevel: "internal",
    selfService: true,
    requiresStrategy: false,
  },
  // ---------------------------------------------------------------- Growth
  {
    slug: "lead-generation",
    name: "Lead generation",
    category: "growth",
    billingType: "monthly",
    summary: "A steady, qualified flow of new business conversations.",
    description:
      "Identifies companies that match your ideal customer, researches why they might need you and prepares personalised, compliant outreach for approval.",
    includedActivities: [
      "Ideal-customer definition",
      "Prospect research",
      "Outreach drafts for approval",
      "Follow-up tracking",
    ],
    deliverables: ["Qualified prospect lists", "Approved outreach", "Monthly pipeline report"],
    kpis: ["Qualified prospects", "Conversations started", "Meetings booked"],
    requiredInputs: ["Ideal customer profile", "Offer and case studies"],
    requiredIntegrations: ["crm"],
    agents: ["lead", "research", "outreach", "quality_control"],
    runKinds: ["lead_opportunity_scan"],
    automationLevel: "assisted",
    humanInvolvement: "Every external message is approved by a person before it is sent.",
    defaultApprovalLevel: "internal",
  },
  {
    slug: "linkedin-networking",
    name: "LinkedIn networking",
    category: "growth",
    billingType: "monthly",
    summary: "Structured, personal LinkedIn networking with the right decision makers.",
    description:
      "We identify relevant decision makers, explain why each is worth connecting with and draft personal messages. You (or we, with your permission) send them. We never automate personal LinkedIn actions against platform rules.",
    includedActivities: [
      "Target list building",
      "Reason-to-connect research",
      "Message and follow-up drafts",
      "Profile optimisation advice",
    ],
    deliverables: ["Weekly connection plan", "Message drafts", "Monthly networking summary"],
    kpis: ["Relevant connections", "Replies", "Meetings from LinkedIn"],
    requiredInputs: ["LinkedIn profile", "Target roles and industries"],
    requiredIntegrations: [],
    agents: ["lead", "outreach"],
    runKinds: ["linkedin_opportunity_scan"],
    automationLevel: "assisted",
    humanInvolvement: "A human performs all LinkedIn actions.",
    defaultApprovalLevel: "manual",
  },
  {
    slug: "google-ads",
    name: "Google Ads management",
    category: "growth",
    billingType: "monthly",
    summary: "Search advertising focused on enquiries, not clicks.",
    description:
      "Campaign strategy, build, conversion tracking and ongoing optimisation. Budget changes always need your approval.",
    includedActivities: [
      "Campaign strategy and build",
      "Conversion tracking",
      "Search term and bid optimisation",
      "Monthly performance review",
    ],
    deliverables: ["Campaign plan", "Live campaigns", "Monthly report"],
    kpis: ["Cost per enquiry", "Conversion rate", "Enquiries"],
    requiredInputs: ["Google Ads account access", "Monthly ad budget"],
    requiredIntegrations: ["analytics"],
    agents: ["analytics", "reporting"],
    runKinds: ["monthly_client_review"],
    automationLevel: "manual",
    humanInvolvement: "Campaign and budget changes approved by the client.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "conversion-optimisation",
    name: "Conversion optimisation",
    category: "growth",
    billingType: "monthly",
    summary: "Turn more of your existing visitors into enquiries.",
    description:
      "Reviews how visitors move through your site, removes friction and improves calls to action, forms and landing pages.",
    includedActivities: [
      "Conversion audit",
      "CTA and form improvements",
      "Landing page recommendations",
      "Enquiry tracking",
    ],
    deliverables: ["Conversion audit", "Implemented improvements", "Monthly results"],
    kpis: ["Conversion rate", "Enquiries", "Form completion"],
    requiredInputs: ["Website access"],
    requiredIntegrations: ["analytics"],
    agents: ["visibility", "analytics"],
    runKinds: ["website_conversion_audit"],
    automationLevel: "assisted",
    humanInvolvement: "Changes approved before going live.",
    defaultApprovalLevel: "client",
  },
  // ---------------------------------------------------------------- Automation
  {
    slug: "ai-workflow-automation",
    name: "AI & workflow automation",
    category: "automation",
    billingType: "once_off",
    summary: "Remove repetitive work so your people can focus on customers and decisions.",
    description:
      "We map a process, design the automation (including AI agents where they genuinely help), build it with human checkpoints and hand it over with documentation.",
    includedActivities: [
      "Process mapping",
      "Automation design",
      "Build and testing",
      "Documentation and handover",
    ],
    deliverables: ["Process map", "Working automation", "Runbook"],
    kpis: ["Hours saved per month", "Error rate", "Turnaround time"],
    requiredInputs: ["Process owner", "Access to the systems involved"],
    requiredIntegrations: [],
    agents: ["operations", "quality_control"],
    runKinds: [],
    automationLevel: "manual",
    humanInvolvement: "Designed and built with the client's team.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "reporting-automation",
    name: "Reporting automation",
    category: "automation",
    billingType: "monthly",
    summary: "Clear business reports that assemble themselves.",
    description:
      "Connects your data sources into one understandable monthly report that explains what happened and what to do next.",
    includedActivities: [
      "Data source connection",
      "Report design",
      "Monthly generation and review",
    ],
    deliverables: ["Automated monthly report"],
    kpis: ["Report on time", "Time saved"],
    requiredInputs: ["Access to data sources"],
    requiredIntegrations: ["analytics"],
    agents: ["reporting", "quality_control"],
    runKinds: ["monthly_client_review"],
    automationLevel: "automated",
    humanInvolvement: "Reviewed before it is published.",
    defaultApprovalLevel: "internal",
  },
  {
    slug: "automation-consulting",
    name: "Automation & AI consulting",
    category: "consulting",
    billingType: "once_off",
    summary: "Find out where automation and AI will actually pay off in your business.",
    description:
      "A structured review of your operations that identifies, sizes and prioritises automation opportunities.",
    includedActivities: ["Discovery workshop", "Process review", "Opportunity sizing", "Roadmap"],
    deliverables: ["Automation opportunity report", "Prioritised roadmap"],
    kpis: ["Opportunities identified", "Estimated hours saved"],
    requiredInputs: ["Workshop with key staff"],
    requiredIntegrations: [],
    agents: ["research", "operations"],
    runKinds: [],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "internal",
    selfService: true,
  },
  // ---------------------------------------------------------------- Creative
  {
    slug: "content-creation",
    name: "Content creation",
    category: "creative",
    billingType: "monthly",
    summary: "Useful, on-brand content that supports visibility and sales.",
    description:
      "Articles, service pages, LinkedIn posts and sales content planned around what your buyers search for and ask.",
    includedActivities: [
      "Content planning",
      "Writing and design",
      "Approval workflow",
      "Publishing where access allows",
    ],
    deliverables: ["Monthly content plan", "Approved content pieces"],
    kpis: ["Content published", "Organic traffic to content", "Engagement"],
    requiredInputs: ["Brand guidelines", "Subject matter access"],
    requiredIntegrations: [],
    agents: ["content", "quality_control"],
    runKinds: ["content_opportunity_scan"],
    automationLevel: "assisted",
    humanInvolvement: "All client-facing content is approved before publishing.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "photography",
    name: "Photography",
    category: "creative",
    billingType: "once_off",
    summary: "Professional photography of your people, work, products and premises.",
    description:
      "Planned shoots that produce authentic imagery for your website, proposals, LinkedIn and campaigns.",
    includedActivities: [
      "Shoot planning",
      "On-site photography",
      "Editing",
      "Delivery in web-ready formats",
    ],
    deliverables: ["Edited image set"],
    kpis: [],
    requiredInputs: ["Shoot brief", "Site access"],
    requiredIntegrations: [],
    agents: [],
    runKinds: [],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "client",
    requiresStrategy: false,
  },
  {
    slug: "videography",
    name: "Videography",
    category: "creative",
    billingType: "once_off",
    summary: "Short, clear videos that explain what you do and why it matters.",
    description: "Company, service, testimonial and social videos, planned around a clear message.",
    includedActivities: ["Script and planning", "Filming", "Editing", "Formats for web and social"],
    deliverables: ["Edited videos"],
    kpis: [],
    requiredInputs: ["Brief", "Site access"],
    requiredIntegrations: [],
    agents: [],
    runKinds: [],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "client",
    requiresStrategy: false,
  },
  {
    slug: "graphic-design",
    name: "Graphic design",
    category: "creative",
    billingType: "once_off",
    summary: "Clear, professional design for digital and print.",
    description:
      "Brand assets, sales documents, presentations, social graphics and campaign creative.",
    includedActivities: ["Design brief", "Concepts", "Revisions", "Final files"],
    deliverables: ["Final design files"],
    kpis: [],
    requiredInputs: ["Brand guidelines"],
    requiredIntegrations: [],
    agents: [],
    runKinds: [],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "client",
    requiresStrategy: false,
  },
  {
    slug: "social-media",
    name: "Social media management",
    category: "creative",
    billingType: "monthly",
    summary: "Consistent, credible social presence, with LinkedIn first for B2B.",
    description:
      "Planning, creating and scheduling posts, with community management and monthly reporting.",
    includedActivities: [
      "Monthly content calendar",
      "Post creation",
      "Scheduling",
      "Community management",
    ],
    deliverables: ["Content calendar", "Published posts", "Monthly report"],
    kpis: ["Reach", "Engagement", "Followers from target audience"],
    requiredInputs: ["Platform access", "Brand guidelines"],
    requiredIntegrations: ["social"],
    agents: ["content"],
    runKinds: ["content_opportunity_scan"],
    automationLevel: "assisted",
    humanInvolvement: "Posts approved before publishing.",
    defaultApprovalLevel: "client",
  },
  // ---------------------------------------------------------------- Website
  {
    slug: "website-development",
    name: "Website development",
    category: "website",
    billingType: "once_off",
    summary: "A fast, clear website built to be found and to convert.",
    description:
      "Strategy, copy, design and build of a website engineered for search, AI discoverability and enquiries.",
    includedActivities: [
      "Strategy and sitemap",
      "Copy and design",
      "Build",
      "SEO and schema foundations",
      "Launch and redirects",
    ],
    deliverables: ["Live website", "Handover documentation"],
    kpis: ["Page speed", "Indexed pages", "Conversion rate"],
    requiredInputs: ["Brand assets", "Content input", "Domain access"],
    requiredIntegrations: [],
    agents: ["seo", "quality_control"],
    runKinds: ["visibility_audit"],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "client",
  },
  {
    slug: "landing-pages",
    name: "Landing & conversion pages",
    category: "website",
    billingType: "once_off",
    summary: "Focused pages for a service, campaign or audience.",
    description: "Single-purpose pages designed around one offer and one next step, with tracking.",
    includedActivities: ["Page strategy", "Copy and design", "Build", "Tracking"],
    deliverables: ["Live landing page"],
    kpis: ["Conversion rate", "Enquiries"],
    requiredInputs: ["Offer details"],
    requiredIntegrations: ["analytics"],
    agents: ["content"],
    runKinds: ["website_conversion_audit"],
    automationLevel: "manual",
    humanInvolvement: "Delivered by Mea Creo.",
    defaultApprovalLevel: "client",
  },
  // ---------------------------------------------------------------- Productised audits
  productised("audit", {
    slug: "digital-visibility-audit",
    name: "Digital Visibility Audit",
    summary: "A structured assessment of how you're found, understood and chosen online.",
    description:
      "Website, Google, SEO, GEO, AEO, content, brand, competitors, conversion and lead capture, assessed and prioritised.",
    includedActivities: [
      "Website",
      "Google presence",
      "SEO, GEO and AEO",
      "Content and brand",
      "Competitors",
      "Conversion and lead capture",
    ],
    deliverables: ["Visibility audit report", "Prioritised recommendations"],
    runKinds: ["visibility_audit", "competitor_analysis", "website_conversion_audit"],
  }),
  productised("audit", {
    slug: "search-opportunity-report",
    name: "Search Opportunity Report",
    summary: "Where the commercial search demand is, and how to win more of it.",
    description:
      "Commercial keywords, search gaps, competitor opportunities, content opportunities, local opportunities and AI-search opportunities.",
    includedActivities: [
      "Commercial keyword research",
      "Search gap analysis",
      "Competitor opportunities",
      "Content and local opportunities",
      "AI-search opportunities",
    ],
    deliverables: ["Search opportunity report"],
    requiredIntegrations: ["search"],
    runKinds: ["seo_analysis", "content_opportunity_scan", "competitor_analysis"],
  }),
  productised("audit", {
    slug: "ai-readiness-audit",
    name: "AI Readiness Audit",
    summary: "Is your business positioned to benefit from AI search, internal AI and automation?",
    description:
      "Assesses readiness for AI and generative search, internal AI use, automation, workflow systems and AI-assisted sales.",
    includedActivities: [
      "AI and generative search readiness",
      "Internal AI opportunities",
      "Automation and workflow readiness",
      "AI-assisted sales readiness",
    ],
    deliverables: ["AI readiness report", "Recommended next steps"],
    runKinds: ["ai_visibility_analysis"],
  }),
  productised("audit", {
    slug: "lead-engine-audit",
    name: "Lead Engine Audit",
    summary: "What happens between a visitor arriving and a sale, and where leads leak.",
    description:
      "Website calls to action, forms, contact mechanisms, booking, lead routing, CRM, follow-up and conversion.",
    includedActivities: [
      "CTAs and forms",
      "Contact and booking mechanisms",
      "Lead routing and CRM",
      "Follow-up process",
      "Conversion",
    ],
    deliverables: ["Lead engine report", "Fix list"],
    runKinds: ["website_conversion_audit"],
  }),
  productised("audit", {
    slug: "digital-brand-audit",
    name: "Digital Brand Audit",
    summary: "How consistently and convincingly your brand shows up online.",
    description:
      "Positioning, visual identity, messaging, consistency, website, social, search and content.",
    includedActivities: [
      "Positioning and messaging",
      "Visual identity and consistency",
      "Website, social and search presence",
      "Content",
    ],
    deliverables: ["Brand audit report", "Recommendations"],
    runKinds: ["visibility_audit"],
  }),
  productised("audit", {
    slug: "automation-opportunity-audit",
    name: "Automation Opportunity Audit",
    summary: "Find the repetitive processes worth automating, sized and prioritised.",
    description:
      "Maps repetitive business processes and identifies where automation and AI will genuinely pay off.",
    includedActivities: ["Process mapping", "Opportunity sizing", "Prioritised roadmap"],
    deliverables: ["Automation opportunity report", "Roadmap"],
    agents: ["research", "operations", "quality_control"],
  }),
  // ---------------------------------------------------------------- Consulting
  productised("consulting", {
    slug: "digital-strategy-consulting",
    name: "Digital & marketing strategy",
    summary:
      "Positioning, messaging, channels and priorities, grounded in data and buyer psychology.",
    description:
      "Strategy work that combines data, psychology, creativity, technology and business strategy into a clear plan.",
    includedActivities: [
      "Discovery workshop",
      "Positioning and messaging",
      "Channel and content plan",
      "Roadmap",
    ],
    deliverables: ["Strategy document", "Roadmap"],
    humanInvolvement: "Delivered by Dylan.",
  }),
  productised("consulting", {
    slug: "growth-consulting",
    name: "Visibility & growth consulting",
    summary: "An outside, practical view of how to grow visibility and pipeline.",
    description: "Ongoing or one-off advisory sessions on visibility, lead generation and growth.",
    includedActivities: ["Advisory sessions", "Prioritised recommendations"],
    deliverables: ["Session notes and actions"],
    humanInvolvement: "Delivered by Dylan.",
  }),
  // ---------------------------------------------------------------- Quality assurance
  productised("quality", {
    slug: "content-quality-assurance",
    name: "Content Quality Assurance",
    summary: "Independent QA of content before it's published.",
    description:
      "Content review, brand compliance, accuracy, visual, messaging, SEO and search-readiness review against a configurable checklist, with a documented approve-or-revise decision and final approval workflow.",
    includedActivities: [
      "Content review",
      "Brand compliance",
      "Accuracy and spelling",
      "Visual and messaging review",
      "SEO, GEO and AEO readiness",
      "Compliance checklist",
      "Final approval workflow",
    ],
    deliverables: ["QA decision per item, with notes", "Monthly quality summary"],
    agents: ["quality_control"],
    humanInvolvement: "Every QA decision is made by a person; automated checks assist.",
  }),
  // ---------------------------------------------------------------- Technology
  productised("automation", {
    slug: "crm-workflow-systems",
    name: "CRM, lead-generation & workflow systems",
    summary: "Lead capture, routing, follow-up and pipeline tracking so no enquiry is lost.",
    description:
      "Design and build of CRM setups, lead-generation systems, workflow automation and integrations between your tools.",
    includedActivities: ["Process mapping", "CRM setup", "Workflow automation", "Integrations"],
    deliverables: ["Working system", "Documentation and handover"],
    automationLevel: "manual",
    humanInvolvement: "Designed and built by Mea Creo.",
  }),
  productised("automation", {
    slug: "dashboards-portals-apps",
    name: "Dashboards, portals & internal applications",
    summary: "Reporting dashboards, client portals and internal tools.",
    description:
      "Custom dashboards, client portals and internal business applications that turn scattered information into clear next actions.",
    includedActivities: ["Requirements", "Design", "Build", "Handover"],
    deliverables: ["Working application", "Documentation"],
    automationLevel: "manual",
    humanInvolvement: "Designed and built by Mea Creo.",
  }),
];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  package: "Packages",
  visibility: "Visibility",
  growth: "Growth",
  creative: "Content",
  automation: "Technology & automation",
  website: "Websites",
  audit: "Productised audits",
  consulting: "Consulting",
  quality: "Quality assurance",
};

/** Package slugs in display order. */
export const PACKAGE_SLUGS = [
  "package-foundation",
  "package-visibility",
  "package-growth",
  "package-scale",
  "package-custom",
] as const;

const NAME_BY_SLUG = new Map(SERVICE_CATALOGUE.map((s) => [s.slug, s.name]));

/** Display name for a catalogue slug (falls back to a humanised slug). */
export function serviceName(slug: string): string {
  return NAME_BY_SLUG.get(slug) ?? slug.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
}
