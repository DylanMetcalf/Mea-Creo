/**
 * Brand colours for places that can't read CSS variables: emails and PDFs.
 * Mirrors the tokens in src/app/globals.css; change both together.
 */
export const BRAND_HEX = {
  ink: "#0e1915",
  muted: "#56655e",
  paper: "#f1f4f0",
  surface: "#ffffff",
  border: "#dde4de",
  brand700: "#1f4a37",
  brand600: "#2d6449",
  brand400: "#62a67f",
  signal: "#7fe0b2",
  night: "#07110d",
} as const;

/** "r g b" in 0–1 for PDF drawing operators. */
export function pdfRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(" ");
}
