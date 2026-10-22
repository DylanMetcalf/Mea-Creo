import type { CmsPlatform } from "@/db/schema";

/** Where on a site a deliverable is applied; each CMS does these differently. */
export type Placement =
  | "title_meta"
  | "head_code"
  | "structured_data"
  | "page_content"
  | "page_language"
  | "robots_file"
  | "sitemap"
  | "root_file";

export const CMS_LABELS: Record<CmsPlatform, string> = {
  unknown: "Not recorded",
  wordpress: "WordPress",
  shopify: "Shopify",
  wix: "Wix",
  squarespace: "Squarespace",
  custom: "Custom / hand-built",
};

type Steps = Record<Exclude<CmsPlatform, "unknown">, string[]>;

/**
 * Platform instructions. Menu names follow each platform's documented admin at the time
 * of writing; the verification step on every fix confirms the change actually landed.
 */
const STEPS: Record<Placement, Steps> = {
  title_meta: {
    wordpress: [
      "Open the page in WordPress (Pages → Edit, or Settings → Reading to find the home page).",
      "In the SEO box from your SEO plugin (Yoast SEO or Rank Math), paste the SEO title and meta description.",
      "Click Update. WordPress core has no meta description field, so an SEO plugin is required.",
    ],
    shopify: [
      "Home page: Online Store → Preferences → Title and meta description.",
      "Other pages: open the page, product or collection → Search engine listing → Edit.",
      "Paste the page title and meta description, then Save.",
    ],
    wix: [
      "In the Editor open Pages & Menu, click ⋯ next to the page → SEO basics.",
      "Paste the title tag and meta description, then Publish the site.",
    ],
    squarespace: [
      "Open Pages, hover the page and click the gear icon → SEO.",
      "Paste the SEO title and SEO description, then Save. For the home page, also check Settings → SEO.",
    ],
    custom: [
      'Edit the page\'s <head>: replace the <title> element and the <meta name="description"> tag.',
      "Deploy the change.",
    ],
  },
  head_code: {
    wordpress: [
      "Most SEO plugins (Yoast SEO, Rank Math) output canonical and Open Graph tags; turn those settings on first.",
      "If they are already on and the tag is still missing, add the code with a header-code plugin (for example WPCode → Header) or the theme's header template.",
    ],
    shopify: [
      "Online Store → Themes → ⋯ → Edit code → layout/theme.liquid.",
      "Paste the code just before </head> and Save. Check the theme doesn't already output the tag to avoid duplicates.",
    ],
    wix: [
      "Wix generates canonical and social tags itself: Pages & Menu → ⋯ → SEO basics / Social share.",
      "For anything else: Settings → Custom Code → Add Custom Code, place it in Head on the right page.",
    ],
    squarespace: [
      "Page level: page settings → Advanced → Page Header Code Injection.",
      "Site wide: Settings → Advanced → Code Injection → Header. Code injection needs a Core/Business plan or higher.",
    ],
    custom: ["Paste the code inside the page's <head> (or the shared layout template) and deploy."],
  },
  structured_data: {
    wordpress: [
      "Check your SEO plugin's schema settings first (Yoast: Settings → Site representation; Rank Math: Schema).",
      "If it can't express this, add the JSON-LD block with a header-code plugin (WPCode → Header) on the page shown.",
    ],
    shopify: [
      "Online Store → Themes → ⋯ → Edit code → layout/theme.liquid (site-wide) or the page template.",
      'Paste the <script type="application/ld+json"> block before </head> and Save.',
    ],
    wix: [
      "Pages & Menu → ⋯ → SEO basics → Advanced SEO → Structured data markup → Add new markup.",
      "Paste the JSON (without the <script> wrapper), Apply, then Publish.",
    ],
    squarespace: [
      "Page settings → Advanced → Page Header Code Injection (or Settings → Advanced → Code Injection for site-wide data).",
      'Paste the full <script type="application/ld+json"> block and Save.',
    ],
    custom: ['Paste the <script type="application/ld+json"> block inside <head> and deploy.'],
  },
  page_content: {
    wordpress: [
      "Edit the page in the block editor and add or change the blocks shown in 'Where it goes'.",
      "Use Heading blocks with the stated level (H1/H2/H3); the heading level is in the block toolbar.",
      "Click Update.",
    ],
    shopify: [
      "Online Store → Pages (or Customize the theme for the home page) and edit the section shown.",
      "Set heading levels in the rich-text editor; Save.",
    ],
    wix: [
      "In the Editor select the text box shown, set the style to the stated heading level (Heading 1, Heading 2…).",
      "Add new text where shown, then Publish.",
    ],
    squarespace: [
      "Edit the page, select the text block and set the format to the stated heading level.",
      "Add new text blocks where shown, then Save.",
    ],
    custom: ["Edit the page's HTML at the location shown and deploy."],
  },
  page_language: {
    wordpress: ["Settings → General → Site Language. The theme then prints the lang attribute."],
    shopify: ["Settings → Languages → set the default language. Themes print it on <html>."],
    wix: ["Settings → Language & region → set the site language, then Publish."],
    squarespace: ["Settings → Language & region → set the site language."],
    custom: ["Add the attribute to the <html> element of the layout template and deploy."],
  },
  robots_file: {
    wordpress: [
      "Yoast SEO: Tools → File editor (or Rank Math → General Settings → Edit robots.txt).",
      "Add the line shown and Save.",
    ],
    shopify: [
      "Online Store → Themes → Edit code → Templates → add robots.txt.liquid if it doesn't exist.",
      "Shopify already lists its sitemap; only add the line if it is missing from the live file.",
    ],
    wix: ["Marketing & SEO → SEO → Robots.txt Editor. Add the line and Save."],
    squarespace: [
      "Squarespace generates robots.txt and does not allow editing it. Its sitemap is at /sitemap.xml; submit that in Search Console instead.",
    ],
    custom: ["Add the line to /robots.txt at the web root and deploy."],
  },
  sitemap: {
    wordpress: [
      "WordPress 5.5+ publishes /wp-sitemap.xml. If you use Yoast SEO, turn on Settings → Site features → XML sitemaps (/sitemap_index.xml).",
      "Then add the sitemap URL to robots.txt and Search Console.",
    ],
    shopify: [
      "Shopify publishes /sitemap.xml automatically. If it's missing, check the store isn't password protected.",
    ],
    wix: [
      "Wix publishes /sitemap.xml automatically once the site is published and connected to a domain.",
    ],
    squarespace: [
      "Squarespace publishes /sitemap.xml automatically. Check the site isn't private or behind a password.",
    ],
    custom: [
      "Save the XML below as /sitemap.xml at the web root (or generate it in your build), then list it in robots.txt.",
    ],
  },
  root_file: {
    wordpress: [
      "Upload the file to the site's root folder (the folder that holds wp-config.php) with your host's file manager or SFTP.",
    ],
    shopify: [
      "Shopify does not allow files at the domain root. Upload it under Content → Files, then add a URL redirect (Online Store → Navigation → URL Redirects) from /llms.txt to the file's URL.",
    ],
    wix: [
      "Wix does not support custom files at the domain root. Record this fix as blocked unless the site moves platform.",
    ],
    squarespace: [
      "Squarespace does not support custom files at the domain root. Record this fix as blocked unless the site moves platform.",
    ],
    custom: ["Save the file at the web root so it is served at the URL shown, then deploy."],
  },
};

export function cmsInstructions(cms: CmsPlatform, placement: Placement): string[] {
  if (cms === "unknown")
    return [
      "Record the client's website platform (Strategy & Brain → Profile → Website platform) to get platform-specific steps.",
      ...STEPS[placement].custom,
    ];
  return STEPS[placement][cms];
}
