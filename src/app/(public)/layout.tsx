import { Logo } from "@/components/brand/logo";

/** Minimal shell for client-facing transactional pages (proposals, checkout). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper min-h-dvh">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
