import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * Mea Creo logo: the hand-drawn "M" signature mark with a Manrope wordmark.
 * The mark is the original monogram, cut out to transparent ink and white versions
 * (public/brand/mark-*.png) so it sits cleanly on any surface.
 * TODO(owner): supply the original vector logo so it can replace the PNG.
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
  const h = { sm: 24, md: 30, lg: 38 }[size];
  const w = Math.round((h * 238) / 146);
  return (
    <Link
      href={href}
      className={cn(
        "group/logo inline-flex shrink-0 items-center gap-2.5 rounded-lg whitespace-nowrap outline-offset-4",
        className,
      )}
      aria-label="Mea Creo home"
    >
      <Image
        src={inverse ? "/brand/mark-white.png" : "/brand/mark-ink.png"}
        alt=""
        width={w}
        height={h}
        priority
        style={{ width: w, height: h }}
        className="transition-transform duration-300 ease-out group-hover/logo:-rotate-3"
      />
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
