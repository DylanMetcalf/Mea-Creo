import { cn } from "@/components/ui/cn";

/**
 * A client's logo on a white tile (logos are usually designed for white, so this keeps them
 * legible in dark mode too), or their initials when no logo has been uploaded.
 */
export function ClientLogo({
  organisationId,
  name,
  hasLogo,
  size = "md",
  className,
}: {
  organisationId: string;
  name: string;
  hasLogo: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    xs: "size-6 rounded-md",
    sm: "size-8 rounded-lg",
    md: "size-11 rounded-xl",
    lg: "size-16 rounded-2xl",
  }[size];
  if (hasLogo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route
      <img
        src={`/api/logos/${organisationId}`}
        alt={`${name} logo`}
        className={cn(box, "ring-border/70 shrink-0 bg-white object-contain p-1 ring-1", className)}
      />
    );
  const initials = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "from-brand-100 to-dusk-100 text-brand-800 ring-brand-300/40 inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold ring-1",
        size === "lg" ? "text-lg" : size === "xs" ? "text-[0.6rem]" : "text-xs",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}
