import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Old Wix URLs → new pages (permanent). See docs/MIGRATION.md. Review against Search
 * Console data before launch and add any URL that still earns traffic or links.
 */
const WIX_REDIRECTS: [string, string][] = [
  ["/social-media", "/services/creative"],
  ["/portfolio", "/work"],
  ["/portfolio-collections/:path*", "/work"],
  ["/photoshoots", "/services/creative"],
  ["/food", "/services/creative"],
  ["/wildlife", "/services/creative"],
  ["/landscape", "/services/creative"],
  ["/lodge-and-travel", "/services/creative"],
  ["/matric-dance", "/services/creative"],
  ["/book-online", "/book"],
  ["/service-page/ads-creation-and-management", "/services/growth"],
  ["/service-page/content-creation", "/services/creative"],
  ["/service-page/website-design-consultation", "/services/creative"],
  ["/service-page/graphic-design", "/services/creative"],
  ["/service-page/social-media-audit", "/visibility-report"],
  ["/service-page/initial-call-social-media-management", "/book"],
  ["/service-page/:path*", "/services"],
  ["/terms-and-conditions", "/legal/terms"],
  ["/blank", "/"],
];

const nextConfig: NextConfig = {
  // Portable build: runs on Vercel, a container, or any Node host.
  output: "standalone",
  poweredByHeader: false,
  experimental: { authInterrupts: true, serverActions: { bodySizeLimit: "26mb" } },
  serverExternalPackages: ["@electric-sql/pglite"],
  async redirects() {
    return WIX_REDIRECTS.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
