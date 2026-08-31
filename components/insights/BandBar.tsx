import type { BurnoutBand } from "@/types/burnout";
import { BAND_FILL, BAND_ON_FILL, BAND_LABEL, BAND_ORDER } from "@/lib/burnout-bands";

/**
 * Band composition for one team as a single proportional bar.
 *
 * Two deliberate choices, both from validating the palette rather than
 * eyeballing it: the four band colours are a *status* palette (a band is a
 * state, not a series identity), and three of the four fall below 3:1
 * contrast against `--surface`. So identity is never carried by colour
 * alone — every non-empty segment shows its count inline, and the legend
 * repeats the numbers. A 2px surface gap separates adjacent fills so two
 * touching segments never read as one.
 */

export function BandBar({ counts, total }: { counts: Record<BurnoutBand, number>; total: number }) {
  const summary = BAND_ORDER.filter((b) => counts[b] > 0)
    .map((b) => `${counts[b]} ${BAND_LABEL[b].toLowerCase()}`)
    .join(", ");

  return (
    <div>
      <div className="flex h-7 gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={summary || "No members"}>
        {BAND_ORDER.map((b) =>
          counts[b] > 0 ? (
            <div
              key={b}
              className="flex items-center justify-center rounded-sm text-xs font-bold tabular-nums"
              style={{
                flexGrow: counts[b],
                flexBasis: 0,
                background: BAND_FILL[b],
                color: BAND_ON_FILL[b],
              }}
              title={`${counts[b]} ${BAND_LABEL[b]}`}
            >
              {counts[b]}
            </div>
          ) : null
        )}
        {total === 0 ? <div className="flex-1 rounded-sm bg-surface-2" /> : null}
      </div>
    </div>
  );
}

/** Shared legend — rendered once above a stack of BandBars, not per row. */
export function BandLegend({ totals }: { totals: Record<BurnoutBand, number> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {BAND_ORDER.map((b) => (
        <div key={b} className="flex items-center gap-1.5 text-xs text-ink-mute">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAND_FILL[b] }} aria-hidden="true" />
          {BAND_LABEL[b]}
          <span className="font-mono text-ink-soft">{totals[b]}</span>
        </div>
      ))}
    </div>
  );
}
