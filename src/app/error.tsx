"use client";

/** Human-readable fallback. Never renders the error message or stack to the visitor. */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong on our side.</h1>
      <p className="text-muted">
        Please try again. If it keeps happening, contact us and we&apos;ll look into it.
      </p>
      <div>
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-contrast rounded-md px-4 py-2 font-medium"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
