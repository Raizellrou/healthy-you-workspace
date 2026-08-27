import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * The "colored number in a card" tile — dashboard, attendance, and the
 * insights pages each grew their own copy of this shape independently.
 * `dot` toggles the small leading indicator attendance's version has;
 * dashboard's version never had one, so it stays optional rather than
 * forcing every caller to pass `dot={false}`.
 */
export function StatTile({
  label,
  value,
  sub,
  color,
  dot = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color: string;
  dot?: boolean;
}) {
  return (
    <Card>
      <div className="mb-1.5 flex items-center gap-1.5">
        {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" /> : null}
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-ink-mute">{sub}</div> : null}
    </Card>
  );
}
