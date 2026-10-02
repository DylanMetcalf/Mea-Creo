import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant =
  "primary" | "cta" | "secondary" | "ghost" | "danger" | "inverse" | "glass";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

/*
 * primary   gradient signal: the main action on a screen
 * cta       the big conversion moments (Book a strategy call, Get your report), with glow
 * secondary quiet surface + border
 * ghost     minimal, for tertiary actions
 * danger    destructive
 * inverse   white, on dark or gradient sections
 * glass     translucent, secondary action on dark sections
 * Every variant has hover, focus-visible, pressed (active) and disabled states;
 * SubmitButton adds the loading state.
 */
const base =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-[11px] font-medium whitespace-nowrap select-none transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-200 ease-out active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(8_19_15/0.25)] hover:shadow-glow hover:-translate-y-px hover:[background-image:var(--gradient-signal-hover)]",
  cta: "bg-signal text-white font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--glow-signal)] hover:-translate-y-0.5 hover:[background-image:var(--gradient-signal-hover)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_14px_36px_-10px_rgb(45_100_73/0.7)]",
  secondary:
    "bg-surface text-ink border border-border-strong shadow-card hover:border-brand-400 hover:text-brand-800 hover:-translate-y-px",
  ghost: "text-ink-soft hover:bg-brand-50 hover:text-ink",
  danger:
    "bg-danger-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] hover:bg-[#981f17] hover:-translate-y-px",
  inverse:
    "bg-white text-brand-900 font-semibold shadow-[0_10px_30px_-12px_rgb(0_0_0/0.5)] hover:-translate-y-0.5 hover:bg-brand-50",
  glass:
    "bg-white/8 text-white border border-white/18 backdrop-blur hover:bg-white/14 hover:border-white/30",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[0.95rem]",
  xl: "h-14 px-7 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
