import { fmtDate } from "@/lib/date";
import type { DayRollup } from "@/lib/attendance";

const MAX_HOURS = 12;

/** 14-day personal timesheet: one bar per work_date, height ~ net hours,
 *  a lighter cap showing break time on top of it. Hand-built divs, same
 *  idiom as components/tasks/WorkloadBar.tsx — no chart dependency. */
export function TimesheetBars({ rollups }: { rollups: DayRollup[] }) {
  if (rollups.length === 0) {
    return <p className="text-sm text-ink-mute">No clocked time in the last 14 days yet.</p>;
  }

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {rollups.map((r) => {
        const netPct = Math.min(100, (r.netHours / MAX_HOURS) * 100);
        const breakPct = Math.min(100 - netPct, (r.breakHours / MAX_HOURS) * 100);
        const barColor = r.netHours > 9.5 ? "#FF8C73" : r.netHours >= 6 ? "#6F49A6" : "#87D380";
        return (
          <div key={r.workDate} className="flex w-9 shrink-0 flex-col items-center gap-1">
            <div className="relative flex h-24 w-full items-end overflow-hidden rounded-md bg-surface-2">
              <div className="w-full" style={{ height: `${breakPct}%`, background: "var(--line)" }} />
              <div
                className="absolute bottom-0 w-full rounded-md"
                style={{ height: `${netPct}%`, background: barColor }}
              />
              {r.openSession ? (
                <span
                  className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-success"
                  aria-label="Still clocked in"
                  title="Still clocked in"
                />
              ) : null}
            </div>
            <span className="text-[10px] font-medium text-ink-mute">{fmtDate(r.workDate).slice(0, 3)}</span>
            <span className="text-[10px] text-ink-mute">{r.netHours.toFixed(1)}h</span>
          </div>
        );
      })}
    </div>
  );
}
