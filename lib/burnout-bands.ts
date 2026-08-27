import type { BurnoutBand } from "@/types/burnout";

export const BAND_ORDER: BurnoutBand[] = ["low", "medium", "high", "critical"];

export const BAND_LABEL: Record<BurnoutBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** A validated status palette, deliberately distinct from the --risk-*
 *  design tokens in app/globals.css: those are low-opacity tints for
 *  badges/progress fills, this is solid-fill text-on-color, and three of
 *  the four steps measure under 3:1 against --surface on their own. Never
 *  carry meaning by color alone — pair with BAND_LABEL/BAND_INK or the
 *  numeric value, the way BandBar and BandChip both already do. Single
 *  source for what was previously copy-pasted into
 *  components/insights/BandBar.tsx and components/burnout/WhatIfSimulator.tsx. */
export const BAND_COLOR: Record<BurnoutBand, string> = {
  low: "#87D380",
  medium: "#6F49A6",
  high: "#FFD700",
  critical: "#FF8C73",
};

/** Ink that stays legible on each BAND_COLOR fill — the yellow and green
 *  steps are far too light for white text, the purple far too dark for
 *  black. */
export const BAND_INK: Record<BurnoutBand, string> = {
  low: "#1d3b1a",
  medium: "#ffffff",
  high: "#4a3c00",
  critical: "#5c1f12",
};
