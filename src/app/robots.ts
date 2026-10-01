import type { MetadataRoute } from "next";

/** Only production is indexable. Private areas are always disallowed. */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const indexable = process.env.APP_ENV === "production";
  return {
    rules: indexable
      ? [
          {
            userAgent: "*",
            allow: "/",
            disallow: [
              "/workspace",
              "/portal",
              "/api",
              "/proposal",
              "/pay",
              "/visibility-report/",
              "/invite",
              "/reset-password",
            ],
          },
        ]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: indexable ? `${siteUrl}/sitemap.xml` : undefined,
  };
}
