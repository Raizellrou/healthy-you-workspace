import type { ReactNode } from "react";

export type ChipTone =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "success"
  | "warning"
  | "neutral"
  | "brand";

/**
 * The four band tones read a tint/ink *pair* from the band tokens in
 * app/globals.css, not one colour used as both.
 *
 * They used to be `bg-risk-medium/15 text-risk-medium` — the saturated fill
 * as text on a 15% tint of itself. Measured in light mode that gave 1.19:1
 * for Medium on /burnout and 1.80:1 for Low, against a WCAG AA requirement
 * of 4.5:1; the gold-on-pale-lavender chip was effectively invisible. The
 * same chips measured 9.19:1 in dark mode, which is how it went unnoticed.
 *
 * --band-*-ink is the darkened (light) or brightened (dark) variant paired
 * with --band-*-tint, and both are re-declared under [data-high-contrast]
 * so that setting actually moves them.
 */
const TONE_CLASSES: Record<ChipTone, string> = {
  low: "bg-band-low-tint text-band-low-ink",
  medium: "bg-band-medium-tint text-band-medium-ink",
  high: "bg-band-high-tint text-band-high-ink",
  critical: "bg-band-critical-tint text-band-critical-ink",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  neutral: "bg-surface-2 text-ink-soft",
  brand: "bg-brand-soft text-brand-ink",
};

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
