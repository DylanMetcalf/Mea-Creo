import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

/**
 * Mea Creo monogram + wordmark. The monogram is the existing hand-drawn "M" logo.
 * TODO(owner): supply the original vector logo so it can replace the PNG.
 */
export function Logo({
  href = "/",
  inverse = false,
  compact = false,
  className,
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Mea Creo home"
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full",
          inverse ? "bg-white" : "bg-surface ring-border ring-1",
        )}
      >
        <Image
          src="/brand/mea-creo-monogram.png"
          alt=""
          width={30}
          height={30}
          priority
          className="size-7"
        />
      </span>
      {!compact && (
        <span
          className={cn(
            "text-[1.05rem] font-semibold tracking-tight",
            inverse ? "text-white" : "text-ink",
          )}
        >
          Mea Creo
        </span>
      )}
    </Link>
  );
}
