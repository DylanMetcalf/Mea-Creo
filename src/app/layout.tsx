import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Display face: Manrope's engineered geometry reads as technical and precise at
// heading sizes without the coldness of a pure grotesk. Geist carries body and UI.
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

const isProduction = process.env.APP_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${siteConfig.name} | Visibility, Growth & Automation`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: { icon: "/brand/favicon-64.png", apple: "/brand/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mea Creo", statusBarStyle: "black-translucent" },
  // Only production is indexable; dev, preview and staging must never compete with the live site.
  robots: isProduction ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#09110e" },
  ],
};

// Applies the saved theme before first paint (no flash). Light is the default.
const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )mc_theme=(light|dark|system)/);document.documentElement.dataset.theme=m?m[1]:"light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-ZA"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
