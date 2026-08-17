import { Avatar } from "@/components/ui/Avatar";

export function WorkloadBar({
  name,
  avatarColor,
  openCount,
  highCount,
  maxCount,
}: {
  name: string;
  avatarColor: string;
  openCount: number;
  highCount: number;
  maxCount: number;
}) {
  const pct = maxCount > 0 ? Math.round((openCount / maxCount) * 100) : 0;
  const barColor = openCount >= 5 ? "#FF8C73" : openCount >= 3 ? "#FFD700" : "#87D380";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-medium text-ink-soft">
          <Avatar name={name} color={avatarColor} size={20} />
          {name}
        </span>
        <span className="font-mono text-ink-mute">
          {openCount} open{highCount > 0 ? ` · ${highCount} high` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={openCount}
        aria-valuemin={0}
        aria-valuemax={maxCount}
        aria-label={`${name} open tasks`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}
