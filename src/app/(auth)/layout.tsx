import { Logo } from "@/components/brand/logo";

/** Sign-in and account pages: the form on the left, a quiet brand moment on the right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main
      id="main"
      className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"
    >
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
      <aside className="bg-night text-night-text relative isolate hidden overflow-hidden lg:flex lg:flex-col lg:justify-end lg:p-14">
        <div aria-hidden className="bg-horizon absolute inset-0 -z-10 opacity-90" />
        <div
          aria-hidden
          className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(70%_60%_at_70%_30%,#000,transparent)]"
        />
        <div
          aria-hidden
          className="bg-signal/20 absolute top-1/4 right-1/4 -z-10 size-80 rounded-full blur-3xl"
        />
        <p className="label-mono text-signal">Mea Creo</p>
        <p className="font-display mt-4 max-w-md text-[2.6rem] leading-[1.05] text-white">
          Easier to find. Easier to understand.{" "}
          <span className="text-gradient-night">Easier to choose.</span>
        </p>
        <p className="text-night-muted mt-5 max-w-sm">
          Your work, reports, approvals and results in one place, with nothing hidden.
        </p>
      </aside>
    </main>
  );
}
