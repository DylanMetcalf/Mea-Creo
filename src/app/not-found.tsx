import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24 sm:px-6">
      <p className="text-muted text-sm font-medium">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">We couldn&apos;t find that page.</h1>
      <p className="text-muted">It may have moved when we rebuilt the site.</p>
      <Link className="text-primary font-medium underline underline-offset-4" href="/">
        Go to the home page
      </Link>
    </main>
  );
}
