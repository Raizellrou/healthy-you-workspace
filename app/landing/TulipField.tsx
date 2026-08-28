/**
 * The decorative tulip row under the closing CTA.
 *
 * This is illustration, not the logo — the brand mark itself is always
 * public/logo.webp via <Logo/>, never redrawn.
 *
 * The bloom is the landing mockup's own `#tulipSide` symbol, copied
 * directly (same path, same viewBox) — not a redrawn shape. It was
 * already right; the only real defect was the layout (see TulipField
 * below), and an unnecessary shape edit in response to that layout
 * complaint is what drifted it into looking like a heart.
 *
 * Purely ornamental: aria-hidden, and the idle sway is CSS
 * (`.landing-field`, app/globals.css) which stops under
 * prefers-reduced-motion.
 *
 * Each tulip is TWO nested elements, not one, because `transform` doesn't
 * compose across an inline style and a CSS animation on the same element —
 * whichever source is animating wins outright for the property's whole
 * value, so a `rotate()` keyframe would silently erase this file's
 * `translate()` staggering the instant the sway animation ran (which is
 * the default, non-reduced-motion state — this isn't an edge case). The
 * outer div carries the static positioning translate; the inner div is
 * the sway animation's only target and carries no other transform.
 */

interface Tulip {
  color: string;
  /** Stem length, as a fraction of the row's max height. */
  height: number;
  /** Extra vertical offset in px, +down / -up, from the shared baseline. */
  shift: number;
  /** Horizontal nudge in px, breaking the row out of an even grid. */
  nudge: number;
}

const TULIPS: Tulip[] = [
  { color: "var(--p1-soft)", height: 0.62, shift: 14, nudge: 0 },
  { color: "var(--p2-soft)", height: 1, shift: -10, nudge: 6 },
  { color: "var(--p3-soft)", height: 0.74, shift: 6, nudge: -4 },
  { color: "var(--p5-soft)", height: 0.96, shift: -14, nudge: 8 },
  { color: "var(--p4-soft)", height: 0.5, shift: 18, nudge: -6 },
  { color: "var(--p2-soft)", height: 0.85, shift: -4, nudge: 4 },
  { color: "var(--p3-soft)", height: 0.68, shift: 10, nudge: -2 },
];

/** The mockup's `#tulipSide` symbol (viewBox 0 0 40 92): one filled bloom
 *  path, one stroked stem path. Verbatim, not reinterpreted. */
function TulipGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 92" className="h-full w-full">
      <path
        d="M20,40 C7,40 3,27 8,17 C11,11 17,8 20,15 C23,8 29,11 32,17 C37,27 33,40 20,40Z"
        fill={color}
      />
      <path d="M20,40 C17,58 22,74 20,92" stroke="var(--stem)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function TulipField() {
  return (
    <div
      className="landing-field mt-16 flex h-[190px] items-end justify-center gap-[clamp(0.5rem,2.6vw,1.625rem)] overflow-visible"
      aria-hidden="true"
    >
      {TULIPS.map((tulip, i) => (
        <div
          key={i}
          className="w-[clamp(1.75rem,3.8vw,3.125rem)]"
          style={{
            height: `${tulip.height * 100}%`,
            transform: `translate(${tulip.nudge}px, ${tulip.shift}px)`,
          }}
        >
          <div className="h-full w-full">
            <TulipGlyph color={tulip.color} />
          </div>
        </div>
      ))}
    </div>
  );
}
