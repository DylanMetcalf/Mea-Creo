import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/config/site";

/** Branded shell for client-facing transactional pages (proposals, checkout, share links). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper relative isolate min-h-dvh">
      <div
        aria-hidden
        className="bg-aurora pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 opacity-30"
      />
      <header className="border-border/70 bg-surface/75 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ThemeToggle compact />
        </div>
        <div aria-hidden className="bg-signal h-px w-full opacity-40" />
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="text-subtle mx-auto max-w-4xl px-4 pb-10 text-xs sm:px-6">
        {siteConfig.legalName} · Reg. {siteConfig.registrationNumber} · {siteConfig.contact.email}
      </footer>
    </div>
  );
}
