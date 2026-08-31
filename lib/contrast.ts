/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Exists so the band palette in app/globals.css can be asserted in CI rather
 * than eyeballed. The chip regression it guards against (a saturated fill
 * used as its own text colour, 1.19:1) was invisible in dark mode and shipped
 * because nobody re-measured the light theme.
 *
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Accepts `#rgb` and `#rrggbb`, with or without the leading hash. */
export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two hex colours, 1:1 to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG AA threshold: 3:1 for large text (>=24px, or >=18.66px bold), else 4.5:1. */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
