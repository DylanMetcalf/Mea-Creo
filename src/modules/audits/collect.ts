import { AppError } from "@/lib/errors";
import { safeFetch, type FetchedPage } from "./fetcher";
import { countSitemapUrls, extractPageSignals, parseRobotsTxt } from "./parse";
import type { AuditSignals } from "./types";

export type Fetcher = (url: string | URL) => Promise<FetchedPage>;

async function tryFetch(fetcher: Fetcher, url: string): Promise<FetchedPage | null> {
  try {
    const page = await fetcher(url);
    return page.status >= 200 && page.status < 300 ? page : null;
  } catch {
    return null;
  }
}

/**
 * Collects visibility signals for a website: the home page, robots.txt, the sitemap
 * and llms.txt. The fetcher is injectable so tests and demo seeding run offline.
 */
export async function collectSignals(
  url: URL,
  fetcher: Fetcher = (u) => safeFetch(u),
): Promise<AuditSignals> {
  let home: FetchedPage;
  try {
    home = await fetcher(url);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("VALIDATION", {
      userMessage: "We couldn't reach that website. Please check the address and try again.",
      cause: error,
    });
  }
  if (home.status >= 400) {
    throw new AppError("VALIDATION", {
      userMessage: `The website returned an error (HTTP ${home.status}). Please check the address.`,
    });
  }

  const finalUrl = new URL(home.finalUrl);
  const origin = finalUrl.origin;
  const page = extractPageSignals(home.body, home.finalUrl);

  const [robots, llms] = await Promise.all([
    tryFetch(fetcher, `${origin}/robots.txt`),
    tryFetch(fetcher, `${origin}/llms.txt`),
  ]);
  const robotsTxt =
    robots && !/<html/i.test(robots.body.slice(0, 500))
      ? parseRobotsTxt(robots.body)
      : { found: false, blocksAll: false, sitemaps: [] };

  const sitemapCandidates = [
    ...robotsTxt.sitemaps,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];
  let sitemap: AuditSignals["sitemap"] = { found: false };
  for (const candidate of [...new Set(sitemapCandidates)].slice(0, 3)) {
    const result = await tryFetch(fetcher, candidate);
    if (result && /<(urlset|sitemapindex)/i.test(result.body)) {
      sitemap = { found: true, url: candidate, urlCount: countSitemapUrls(result.body) };
      break;
    }
  }

  const { internalPaths: _internalPaths, ...pageSignals } = page;
  return {
    ...pageSignals,
    statusCode: home.status,
    finalUrl: home.finalUrl,
    https: finalUrl.protocol === "https:",
    responseTimeMs: home.responseTimeMs,
    htmlBytes: home.bytes,
    robotsTxt,
    sitemap,
    llmsTxt: Boolean(
      llms && llms.body.trim().length > 20 && !/<html/i.test(llms.body.slice(0, 500)),
    ),
    pagesAnalysed: [home.finalUrl],
  };
}
