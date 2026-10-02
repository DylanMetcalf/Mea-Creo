import { cn } from "@/components/ui/cn";

/**
 * Mea Creo Visibility Index ring (0–100). The arc draws in on load; the number is
 * always present in the markup, so it reads correctly without animation.
 */
export function IndexRing({
  value,
  size = 132,
  stroke = 10,
  inverse = false,
  label = "Visibility Index",
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  inverse?: boolean;
  label?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const id = `ring-${size}-${inverse ? "n" : "l"}`;
  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${v} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={inverse ? "#b9f0d3" : "#2d6449"} />
            <stop offset="60%" stopColor={inverse ? "#7fe0b2" : "#43835f"} />
            <stop offset="100%" stopColor={inverse ? "#9db7d3" : "#3b6684"} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={inverse ? "rgb(255 255 255 / 0.1)" : "var(--brand-50)"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${id})`}
          strokeDasharray={`${(c * v) / 100} ${c}`}
          className="draw-in"
          style={{ ["--len" as string]: `${(c * v) / 100}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display leading-none tabular-nums",
            inverse ? "text-white" : "text-ink",
          )}
          style={{ fontSize: size * 0.3 }}
        >
          {v}
        </span>
        <span
          className={cn("label-mono mt-1", inverse ? "text-night-muted" : "text-muted")}
          style={{ fontSize: Math.max(9, size * 0.07) }}
        >
          / 100
        </span>
      </div>
    </div>
  );
}
