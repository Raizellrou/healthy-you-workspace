import type { IconName } from "@/components/icons/Icon";
import { Icon } from "@/components/icons/Icon";

export function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-mute">
        <Icon name={icon} size={16} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-ink">{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink-mute">{sub}</div> : null}
    </div>
  );
}
