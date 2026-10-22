import { Badge, type Tone } from "@/components/ui/primitives";
import type { FixArea, FixClassification, FixStatus } from "@/db/schema";
import { FIX_STATUS_LABELS } from "@/modules/execution/service";

export const AREA_LABELS: Record<FixArea, string> = {
  seo: "SEO",
  technical: "Technical SEO",
  aeo: "AEO",
  geo: "GEO",
  conversion: "Conversion",
};

const CLASSIFICATION: Record<FixClassification, { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed issue", tone: "danger" },
  improvement: { label: "Improvement", tone: "info" },
  hypothesis: { label: "Hypothesis to test", tone: "clay" },
};

const STATUS_TONE: Record<FixStatus, Tone> = {
  draft: "neutral",
  review: "warning",
  approved: "info",
  applied: "brand",
  verified: "success",
  dismissed: "neutral",
};

export function ClassificationBadge({ value }: { value: FixClassification }) {
  return <Badge tone={CLASSIFICATION[value].tone}>{CLASSIFICATION[value].label}</Badge>;
}

export function FixStatusBadge({ value }: { value: FixStatus }) {
  return <Badge tone={STATUS_TONE[value]}>{FIX_STATUS_LABELS[value]}</Badge>;
}

export function PriorityBadge({ value }: { value: "high" | "medium" | "low" }) {
  return (
    <Badge tone={value === "high" ? "warning" : "neutral"}>
      {value[0].toUpperCase() + value.slice(1)}
    </Badge>
  );
}
