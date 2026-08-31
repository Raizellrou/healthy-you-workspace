import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AA_NORMAL, contrastRatio, parseHex, relativeLuminance } from "@/lib/contrast";
import { BAND_ORDER } from "@/lib/burnout-bands";

/**
 * Guards the band palette in app/globals.css against the regression that
 * produced it: Chip rendered `text-risk-medium` on `bg-risk-medium/15` — one
 * saturated colour used as both fill and text — which measured 1.19:1 in the
 * light theme and 9.19:1 in dark. It shipped because dark mode was the one
 * that got looked at.
 *
 * This parses the stylesheet rather than duplicating the hexes, so editing a
 * token without re-checking its pair fails here instead of in production.
 * Every band is asserted in all four states the palette can be in: light,
 * dark, and each of those with high contrast enabled.
 */

const CSS = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

/**
 * Pulls the declarations out of one top-level block by brace matching, so a
 * nested rule (the media query wrapping a :root) can't leak tokens from a
 * sibling block into the map.
 */
function blockAt(startIndex: number): string {
  const open = CSS.indexOf("{", startIndex);
  let depth = 0;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    else if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`Unterminated block at ${startIndex}`);
}

function tokensOf(selector: string, occurrence = 0): Record<string, string> {
  let index = -1;
  for (let n = 0; n <= occurrence; n += 1) {
    index = CSS.indexOf(selector, index + 1);
    if (index === -1) throw new Error(`Selector not found (occurrence ${occurrence}): ${selector}`);
  }
  const body = blockAt(index);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

/** Light lives on bare `:root`; the two dark blocks must agree, so either works. */
const LIGHT = tokensOf(":root {");
const DARK = tokensOf(':root[data-theme="dark"] {');
const HC_LIGHT = tokensOf(':root[data-high-contrast="true"] {');
const HC_DARK = tokensOf(':root[data-theme="dark"][data-high-contrast="true"] {');

const THEMES = [
  { name: "light", tokens: LIGHT, overrides: {} as Record<string, string> },
  { name: "dark", tokens: { ...LIGHT, ...DARK }, overrides: {} as Record<string, string> },
  { name: "light + high contrast", tokens: LIGHT, overrides: HC_LIGHT },
  { name: "dark + high contrast", tokens: { ...LIGHT, ...DARK }, overrides: HC_DARK },
];

describe("contrastRatio", () => {
  it("matches the WCAG reference extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is order independent", () => {
    expect(contrastRatio("#87d380", "#1d3b1a")).toBeCloseTo(contrastRatio("#1d3b1a", "#87d380"), 10);
  });

  it("parses shorthand hex and tolerates a missing hash", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("87d380")).toEqual(parseHex("#87D380"));
  });

  it("rejects a non-colour", () => {
    expect(() => parseHex("var(--band-low-fill)")).toThrow(/Not a hex colour/);
  });

  it("orders luminance as expected", () => {
    expect(relativeLuminance(parseHex("#ffffff"))).toBeGreaterThan(relativeLuminance(parseHex("#808080")));
  });
});

describe("band palette meets WCAG AA in every theme", () => {
  for (const { name, tokens, overrides } of THEMES) {
    describe(name, () => {
      const resolve = (token: string) => {
        const value = overrides[token] ?? tokens[token];
        if (!value) throw new Error(`Token ${token} is not defined in the ${name} block`);
        return value;
      };

      for (const band of BAND_ORDER) {
        it(`${band}: ink on tint`, () => {
          const ratio = contrastRatio(resolve(`--band-${band}-ink`), resolve(`--band-${band}-tint`));
          expect(ratio, `--band-${band}-ink on --band-${band}-tint`).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it(`${band}: on-fill text over fill`, () => {
          const ratio = contrastRatio(resolve(`--band-${band}-on-fill`), resolve(`--band-${band}-fill`));
          expect(ratio, `--band-${band}-on-fill on --band-${band}-fill`).toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it(`${band}: ink is legible on the page surface too`, () => {
          // BurnoutClient and WhatIfSimulator draw the score in --band-*-ink
          // directly on --surface, not on a tint.
          const ratio = contrastRatio(resolve(`--band-${band}-ink`), resolve("--surface"));
          expect(ratio, `--band-${band}-ink on --surface`).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    });
  }
});

describe("high contrast actually increases contrast", () => {
  it("raises every band ink rather than leaving it untouched", () => {
    // The original bug: the setting remapped only --ink-mute and --line, so
    // band chips measured 1.80:1 both with it off and with it on.
    for (const band of BAND_ORDER) {
      const token = `--band-${band}-ink`;
      const base = contrastRatio(LIGHT[token], LIGHT[`--band-${band}-tint`]);
      const raised = contrastRatio(HC_LIGHT[token], LIGHT[`--band-${band}-tint`]);
      expect(raised, `${token} under high contrast`).toBeGreaterThan(base);
    }
  });
});

describe("no hue means two different severities", () => {
  it("gives every band a distinct fill", () => {
    // Gold was Medium under --risk-* and High under the old BAND_COLOR, so a
    // single hex encoded two severities depending on the screen.
    const fills = BAND_ORDER.map((b) => LIGHT[`--band-${b}-fill`].toLowerCase());
    expect(new Set(fills).size).toBe(BAND_ORDER.length);
  });
});
