import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/burnout/Sparkline";
import { BandChip } from "@/components/burnout/BandChip";
import { BAND_COLOR } from "@/lib/burnout-bands";
import type { ForecastPoint } from "@/lib/forecast";

/**
 * Renders the 7-day-out point big, since that's the one decision-relevant
 * number ("where does this person land by next week"); the sparkline shows
 * the path there. Both come from the same forecastNext7Days() call, no
 * separate fetch.
 */
export function ForecastCard({ forecast }: { forecast: ForecastPoint[] }) {
  if (forecast.length === 0) return null;
  const last = forecast[forecast.length - 1];
  const values = forecast.map((p) => p.compositeV2);
  const hasMediumConfidence = forecast.some((p) => p.confidence === "medium");

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">7-day forecast</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">{last.compositeV2}</span>
            <BandChip band={last.bandV2} />
          </div>
        </div>
        <Sparkline
          values={values}
          width={140}
          height={40}
          stroke={BAND_COLOR[last.bandV2]}
          ariaLabel="7-day burnout forecast"
        />
      </div>
      <p className="mt-3 text-xs text-ink-mute">
        Projected forward from today&apos;s score using scheduled meetings, tasks coming due, and booked time
        off.{hasMediumConfidence ? " Later days lean on thinner calendar data." : ""} Not a prediction of what
        will happen, a projection of what&apos;s already on the calendar.
      </p>
    </Card>
  );
}
