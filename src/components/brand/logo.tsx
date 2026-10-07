import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * Mea Creo logo: the hand-drawn "M" signature mark with a Manrope wordmark.
 * Marks and full lockups come from the director's master logo files (public/brand/):
 * mark-ink / mark-white for UI, lockup-ink / lockup-white for documents and emails.
 */
export function Logo({
  href = "/",
  inverse = false,
  compact = false,
  size = "md",
  wordmarkFrom,
  className,
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  /** Hide the wordmark below this breakpoint (tight mobile headers). */
  wordmarkFrom?: "sm";
  className?: string;
}) {
  const h = { sm: 26, md: 32, lg: 40 }[size];
  const w = Math.round((h * 496) / 301);
  const markClass = "transition-transform duration-300 ease-out group-hover/logo:-rotate-3";
  return (
    <Link
      href={href}
      className={cn(
        "group/logo inline-flex shrink-0 items-center gap-2.5 rounded-lg whitespace-nowrap outline-offset-4",
        className,
      )}
      aria-label="Mea Creo home"
    >
      {inverse ? (
        <Image
          src="/brand/mark-white.png"
          alt=""
          width={w}
          height={h}
          priority
          style={{ width: w, height: h }}
          className={markClass}
        />
      ) : (
        <>
          <Image
            src="/brand/mark-ink.png"
            alt=""
            width={w}
            height={h}
            priority
            style={{ width: w, height: h }}
            className={cn(markClass, "dark:hidden")}
          />
          <Image
            src="/brand/mark-white.png"
            alt=""
            width={w}
            height={h}
            style={{ width: w, height: h }}
            className={cn(markClass, "hidden dark:block")}
          />
        </>
      )}
      {!compact && (
        <span
          className={cn(
            "font-display leading-none",
            wordmarkFrom === "sm" && "hidden sm:inline",
            size === "sm" ? "text-[1.05rem]" : size === "lg" ? "text-[1.6rem]" : "text-[1.3rem]",
            inverse ? "text-white" : "text-ink",
          )}
        >
          Mea Creo
        </span>
      )}
    </Link>
  );
}
