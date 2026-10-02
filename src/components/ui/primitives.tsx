import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border-border/80 bg-surface shadow-card border", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex items-start justify-between gap-4 border-b px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-ink text-[0.95rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "clay";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-soft ring-border",
  brand: "bg-brand-50 text-brand-800 ring-brand-100",
  success: "bg-success-100 text-success-700 ring-success-100",
  warning: "bg-warning-100 text-warning-700 ring-warning-100",
  danger: "bg-danger-100 text-danger-700 ring-danger-100",
  info: "bg-info-100 text-info-700 ring-info-100",
  clay: "bg-clay-100 text-clay-600 ring-clay-100",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label-mono text-brand-600 mb-2">{eyebrow}</div>}
        <h1 className="font-display text-ink text-[1.7rem] leading-tight sm:text-[2rem]">
          {title}
        </h1>
        {description && <p className="text-muted mt-1.5 max-w-3xl text-[0.95rem]">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border-border/80 bg-surface relative flex flex-col items-center justify-center overflow-hidden border px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="bg-grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_70%_at_50%_40%,#000,transparent)]"
      />
      {icon && (
        <div className="from-brand-50 to-dusk-100 text-brand-700 ring-brand-100 relative mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1">
          {icon}
        </div>
      )}
      <p className="text-ink relative font-semibold">{title}</p>
      {description && <p className="text-muted relative mt-1 max-w-md text-sm">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  href?: string;
}) {
  const content = (
    <>
      <div className="text-muted text-[0.78rem] font-medium">{label}</div>
      <div
        className={cn(
          "font-display mt-1.5 text-[1.65rem] leading-none tabular-nums",
          tone === "warning" && "text-warning-700",
          tone === "danger" && "text-danger-700",
          tone === "success" && "text-success-700",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-muted mt-1 text-xs">{hint}</div>}
    </>
  );
  const cls = "block rounded-card border border-border/80 bg-surface px-4 py-3.5 shadow-card";
  return href ? (
    <a
      href={href}
      className={cn(
        cls,
        "hover:border-brand-300 hover:shadow-raised transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5",
      )}
    >
      {content}
    </a>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="note"
      className={cn(
        "rounded-card flex flex-col gap-3 px-4 py-3 text-sm ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between",
        toneClasses[tone],
      )}
    >
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cn(title ? "mt-0.5" : undefined, "opacity-90")}>{children}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "from-brand-100 to-dusk-100 text-brand-800 ring-brand-300/40 inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold ring-1",
        size === "sm" ? "size-7 text-[0.7rem]" : "size-9 text-xs",
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function DescriptionList({
  items,
  className,
}: {
  items: [ReactNode, ReactNode][];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,10rem)_1fr]",
        className,
      )}
    >
      {items.map(([term, detail], i) => (
        <div key={i} className="contents">
          <dt className="text-muted text-sm">{term}</dt>
          <dd className="text-ink text-sm">
            {detail ?? <span className="text-subtle">Not set</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      {label && (
        <div className="text-muted mb-1 flex justify-between text-xs">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className="bg-brand-50 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="bg-signal h-full rounded-full" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="label-mono text-muted">{children}</h2>
      {action}
    </div>
  );
}
