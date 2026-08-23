/**
 * A single-series magnitude bar: one hue, value labelled in text ink beside
 * the label rather than printed on the fill. Single series, so no legend —
 * the row label names it (see the dataviz rule: a legend box exists only
 * for two or more series).
 *
 * `scaleMax` lets a stack of these share one scale. Passing the max of the
 * set keeps rows comparable; leaving it at 100 reads as a true percentage.
 */
export function MetricBar({
  label,
  value,
  display,
  sub,
  scaleMax = 100,
  color = "var(--brand)",
  emphasis = false,
}: {
  label: string;
  value: number;
  display: string;
  sub?: string;
  scaleMax?: number;
  color?: string;
  emphasis?: boolean;
}) {
  const pct = scaleMax <= 0 ? 0 : Math.min(100, Math.max(0, (value / scaleMax) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate font-medium text-ink-soft">{label}</span>
        <span className="shrink-0 font-mono text-ink-mute">
          <span className={emphasis ? "font-semibold text-ink" : undefined}>{display}</span>
          {sub ? <span className="ml-1.5">{sub}</span> : null}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(scaleMax)}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
