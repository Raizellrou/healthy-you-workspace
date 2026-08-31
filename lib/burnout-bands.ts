import type { BurnoutBand } from "@/types/burnout";

export const BAND_ORDER: BurnoutBand[] = ["low", "medium", "high", "critical"];

export const BAND_LABEL: Record<BurnoutBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * The band palette, as CSS custom properties rather than literal hexes.
 *
 * Previously this file held its own four hexes and app/globals.css held four
 * more under --risk-*, and the two disagreed: gold was Medium on /burnout and
 * /directory but High here on /insights, salmon was High on one screen and
 * Critical on the other. Because the same hex values were reused one severity
 * step apart, an HR user scanning Insights for the worst team and then opening
 * Burnout Risk saw one colour mean two different things.
 *
 * There is now one definition, in app/globals.css, which is also the only
 * place that can vary a colour by theme, by high-contrast, or by muted
 * palette. These exports are `var()` references so every consumer picks up
 * all three automatically. Passing them to an inline `style` works exactly
 * as a hex would.
 *
 * Two roles, and they are not interchangeable:
 *   BAND_FILL / BAND_ON_FILL — a solid segment with text on top (BandBar).
 *   Chip's tint/ink pair      — a subtle badge (BandChip), via Tailwind
 *                               classes generated from the same tokens.
 *
 * Never render BAND_FILL as a text colour. That is precisely the bug this
 * replaced: a saturated fill used as text on a 15% tint of itself measured
 * 1.19:1 in light mode. Contrast for every pair is asserted in
 * lib/__tests__/contrast.test.ts.
 *
 * Colour still never carries meaning alone — BandBar prints the count inside
 * each segment and repeats it in the legend, and BandChip always shows
 * BAND_LABEL.
 */
export const BAND_FILL: Record<BurnoutBand, string> = {
  low: "var(--band-low-fill)",
  medium: "var(--band-medium-fill)",
  high: "var(--band-high-fill)",
  critical: "var(--band-critical-fill)",
};

/** Text drawn on top of the matching BAND_FILL. */
export const BAND_ON_FILL: Record<BurnoutBand, string> = {
  low: "var(--band-low-on-fill)",
  medium: "var(--band-medium-on-fill)",
  high: "var(--band-high-on-fill)",
  critical: "var(--band-critical-on-fill)",
};

/**
 * Text (or a thin graphic stroke) drawn on a normal page background —
 * --surface, --surface-2, or a band tint. Always this, never BAND_FILL.
 *
 * The fills are chosen to be legible *under* dark text, which makes several
 * of them nearly invisible *as* text: the medium gold measures about 1.4:1
 * on white. Three places were doing exactly that — the score number in the
 * burnout table, the projected score in the what-if simulator, and the
 * sparkline stroke — so a High or Critical row rendered its own score in a
 * colour that could barely be seen. These tokens are the darkened (light
 * theme) or brightened (dark theme) variant of each band, clearing AA as
 * text and 3:1 as a graphic in both.
 */
export const BAND_TEXT: Record<BurnoutBand, string> = {
  low: "var(--band-low-ink)",
  medium: "var(--band-medium-ink)",
  high: "var(--band-high-ink)",
  critical: "var(--band-critical-ink)",
};
