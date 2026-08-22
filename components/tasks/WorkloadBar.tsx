import { Avatar } from "@/components/ui/Avatar";

/** Capacity-based, not a raw open-task count: the bar fills to `loadPct` of
 *  the person's weekly_capacity_hours, coloring red once committed hours
 *  exceed it — the "so what do I do about this" view a manager actually
 *  wants, versus treating a 30-minute task the same as a 2-day one. */
export function WorkloadBar({
  name,
  avatarColor,
  committedHours,
  capacityHours,
  loadPct,
  openCount,
  overdueCount,
}: {
  name: string;
  avatarColor: string;
  committedHours: number;
  capacityHours: number;
  loadPct: number;
  openCount: number;
  overdueCount: number;
}) {
  const barColor = loadPct > 100 ? "#FF8C73" : loadPct >= 75 ? "#FFD700" : "#87D380";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-medium text-ink-soft">
          <Avatar name={name} color={avatarColor} size={20} />
          {name}
        </span>
        <span className="font-mono text-ink-mute">
          {committedHours}h / {capacityHours}h · {openCount} open
          {overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={loadPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} capacity load`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, loadPct)}%`, background: barColor }} />
      </div>
    </div>
  );
}
