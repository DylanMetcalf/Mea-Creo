import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24 sm:px-6">
      <p className="text-muted text-sm font-medium">403</p>
      <h1 className="text-3xl font-semibold tracking-tight">You don&apos;t have access to this.</h1>
      <p className="text-muted">
        If you think you should, ask the account owner to update your role.
      </p>
      <Link className="text-brand-700 font-medium underline underline-offset-4" href="/">
        Go to the home page
      </Link>
    </main>
  );
}
