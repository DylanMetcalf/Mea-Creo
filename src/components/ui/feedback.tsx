import { AlertOctagon, ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Placeholder shimmer while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "bg-border/60 relative overflow-hidden rounded-lg",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent motion-safe:after:animate-[shimmer_1.4s_infinite]",
        className,
      )}
    />
  );
}

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("text-brand-600 inline-flex items-center gap-2", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A page-level loading layout: header, metric row and two panels. */
export function PageSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/** Something failed: say what, and what the person can do. */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="border-danger-100 bg-surface rounded-card flex flex-col items-center border px-6 py-12 text-center"
    >
      <span className="bg-danger-100 text-danger-700 flex size-12 items-center justify-center rounded-2xl">
        <AlertOctagon className="size-6" aria-hidden />
      </span>
      <p className="text-ink mt-4 font-semibold">{title}</p>
      {description && <p className="text-muted mt-1 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A KPI with an optional change against the previous period. */
export function Metric({
  label,
  value,
  change,
  hint,
}: {
  label: string;
  value: ReactNode;
  /** Percentage change; positive is shown as an increase. */
  change?: number | null;
  hint?: ReactNode;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="rounded-card border-border/80 bg-surface shadow-card border px-4 py-3.5">
      <p className="text-muted text-[0.78rem] font-medium">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-[1.65rem] leading-none tabular-nums">{value}</span>
        {change !== undefined && change !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
              up ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700",
            )}
          >
            {up ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden />
            )}
            {Math.abs(change)}%<span className="sr-only">{up ? " increase" : " decrease"}</span>
          </span>
        )}
      </div>
      {hint && <p className="text-muted mt-1.5 text-xs">{hint}</p>}
    </div>
  );
}

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
}

const DOT = {
  brand: "bg-brand-500 ring-brand-100",
  success: "bg-success-700 ring-success-100",
  warning: "bg-ember-500 ring-warning-100",
  danger: "bg-danger-solid ring-danger-100",
  neutral: "bg-subtle ring-surface-2",
};

/** Vertical timeline / activity feed: what happened, in order. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-5", className)}>
      <span aria-hidden className="bg-border absolute top-1.5 bottom-1.5 left-[5px] w-px" />
      {items.map((i) => (
        <li key={i.id} className="relative pl-7">
          <span
            aria-hidden
            className={cn(
              "absolute top-1 left-0 size-[11px] rounded-full ring-4",
              DOT[i.tone ?? "brand"],
            )}
          />
          <p className="text-ink text-sm font-medium">{i.title}</p>
          {i.meta && <p className="text-muted mt-0.5 text-xs">{i.meta}</p>}
          {i.body && <div className="text-ink-soft mt-1.5 text-sm">{i.body}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Hover/focus tooltip without JavaScript. Wrap a focusable element. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="bg-night pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 translate-y-1 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all duration-150 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="label-mono border-border bg-surface text-muted rounded border px-1.5 py-0.5 text-[0.65rem]">
      {children}
    </kbd>
  );
}

/** Styled data table wrapper: scrolls on narrow screens, never the page. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-card border-border/80 bg-surface shadow-card overflow-x-auto border",
        className,
      )}
    >
      <table className="[&_tbody_tr]:border-border/70 [&_tbody_tr:hover]:bg-surface-2 [&_th]:label-mono [&_th]:text-muted [&_th]:bg-surface-2/70 w-full text-left text-sm [&_tbody_tr]:border-t [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-normal">
        {children}
      </table>
    </div>
  );
}
