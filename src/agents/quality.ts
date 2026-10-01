/**
 * Quality control for client-facing output. Deterministic, so it works without AI and
 * can't be talked out of its rules. Returns issues for a human to review.
 */

export interface QualityIssue {
  severity: "block" | "warn";
  rule: string;
  detail: string;
}

const GUARANTEE_PATTERNS: [RegExp, string][] = [
  [/\bguarantee(d|s)?\b/i, "Mentions a guarantee"],
  [/\b(#1|number one|no\.? ?1)\s+(rank|ranking|position|on google)/i, "Promises a #1 ranking"],
  [/\b(first page|page one) (guaranteed|results guaranteed)/i, "Promises first-page results"],
  [/\bguaranteed (leads|sales|revenue|citations?|rankings?)\b/i, "Promises specific outcomes"],
  [/\b(will|we will) (rank|appear) (first|#1|at the top)\b/i, "Predicts a ranking outcome"],
];

const BUZZWORDS = [
  "cutting-edge",
  "revolutionary",
  "world-class",
  "unlock your potential",
  "game-changing",
  "game changer",
  "synergy",
  "leverage cutting",
];

export function checkQuality(
  text: string,
  context: { restrictedClaims?: string[]; knownPrices?: string[] } = {},
): { passed: boolean; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  for (const [pattern, rule] of GUARANTEE_PATTERNS) {
    const match = text.match(pattern);
    if (match) issues.push({ severity: "block", rule, detail: `"${match[0]}"` });
  }
  for (const word of BUZZWORDS) {
    if (text.toLowerCase().includes(word))
      issues.push({
        severity: "warn",
        rule: "Buzzword",
        detail: `Avoid "${word}". Use plain, specific language.`,
      });
  }
  for (const claim of context.restrictedClaims ?? []) {
    const keywords = claim
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 5);
    if (keywords.length && keywords.every((k) => text.toLowerCase().includes(k))) {
      issues.push({
        severity: "block",
        rule: "Restricted claim",
        detail: `Matches a restricted claim: ${claim}`,
      });
    }
  }
  const priceMentions = text.match(/R\s?\d[\d\s,]*(\.\d{2})?/g) ?? [];
  for (const price of priceMentions) {
    const normalised = price.replace(/\s|,/g, "");
    if (
      context.knownPrices &&
      !context.knownPrices.some((p) => p.replace(/\s|,/g, "") === normalised)
    ) {
      issues.push({
        severity: "warn",
        rule: "Unverified price",
        detail: `${price.trim()} doesn't match a configured price.`,
      });
    }
  }
  for (const url of text.match(/https?:\/\/[^\s)]+/g) ?? []) {
    if (/localhost|example\.com|\.test\b/.test(url))
      issues.push({ severity: "warn", rule: "Placeholder link", detail: url });
  }
  if (/\b(lorem ipsum|TODO|TBD|\[insert)/i.test(text))
    issues.push({
      severity: "block",
      rule: "Placeholder text",
      detail: "Contains placeholder text.",
    });
  return { passed: !issues.some((i) => i.severity === "block"), issues };
}
