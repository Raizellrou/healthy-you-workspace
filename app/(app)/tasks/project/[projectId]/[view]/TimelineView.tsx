import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { dailyCommitment, layoutBars, type TimelineTaskInput } from "@/lib/timeline";
import { eachDay, fmtDate, type IsoDate } from "@/lib/date";
import type { Task } from "@/types/task";
import type { Person } from "@/types/person";

const DAY_PX = 28;
const LANE_PX = 26;

function toTimelineInput(t: Task): TimelineTaskInput {
  return {
    id: t.id,
    title: t.title,
    assignee_id: t.assignee_id,
    start_date: t.start_date ?? null,
    due_date: t.due_date,
    estimate_hours: t.estimate_hours ?? null,
    priority: t.priority,
    done: t.done,
  };
}

/** The crunch-period detector: bars run start_date -> due_date, one row per
 *  assignee, with a capacity heat strip above showing per-day committed
 *  hours against the selected people's combined daily capacity. */
export function TimelineView({
  tasks,
  people,
  rangeStart,
  rangeEnd,
}: {
  tasks: Task[];
  people: Person[];
  rangeStart: IsoDate;
  rangeEnd: IsoDate;
}) {
  const days = eachDay(rangeStart, rangeEnd);

  function clamp(date: IsoDate): IsoDate {
    if (date < rangeStart) return rangeStart;
    if (date > rangeEnd) return rangeEnd;
    return date;
  }

  const inputs = tasks
    .filter((t) => !t.done && t.due_date && t.due_date >= rangeStart && (t.start_date ?? t.due_date) <= rangeEnd)
    .map(toTimelineInput);

  const totalCapacityPerDay = people.reduce((sum, p) => sum + p.weeklyCapacityHours / 5, 0);
  const commitment = dailyCommitment(inputs, rangeStart, rangeEnd);

  const byAssignee = new Map<string, TimelineTaskInput[]>();
  for (const t of inputs) {
    if (!t.assignee_id) continue;
    const list = byAssignee.get(t.assignee_id) ?? [];
    list.push(t);
    byAssignee.set(t.assignee_id, list);
  }

  const rows = people
    .map((p) => ({ person: p, bars: layoutBars(byAssignee.get(p.id) ?? []) }))
    .filter((r) => r.bars.length > 0);

  function xFor(date: IsoDate): number {
    return days.findIndex((d) => d === clamp(date)) * DAY_PX;
  }
  function widthFor(bar: { start: IsoDate; end: IsoDate }): number {
    const startIdx = days.findIndex((d) => d === clamp(bar.start));
    const endIdx = days.findIndex((d) => d === clamp(bar.end));
    return (endIdx - startIdx + 1) * DAY_PX - 4;
  }

  const gridWidth = days.length * DAY_PX;

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-mute">No dated tasks in the next 30 days.</p>;
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ width: gridWidth + 148 }}>
        <div className="flex">
          <div className="w-[148px] shrink-0" />
          <div className="flex text-[9px] text-ink-mute" style={{ width: gridWidth }}>
            {days.map((d) => (
              <div key={d} className="shrink-0 text-center" style={{ width: DAY_PX }}>
                {fmtDate(d).slice(0, 2)}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-3 flex items-center">
          <div className="w-[148px] shrink-0 pr-2 text-right text-[10px] font-medium text-ink-mute">Capacity</div>
          <div className="flex" style={{ width: gridWidth }}>
            {days.map((d) => {
              const hours = commitment.get(d) ?? 0;
              const pct = totalCapacityPerDay > 0 ? hours / totalCapacityPerDay : 0;
              const color = pct > 1 ? "#FF8C73" : pct > 0.75 ? "#FFD700" : "#87D380";
              return (
                <div key={d} className="shrink-0 px-0.5" style={{ width: DAY_PX }}>
                  <div
                    className="h-3 rounded-sm"
                    style={{ background: color, opacity: hours > 0 ? 1 : 0.15 }}
                    title={`${hours.toFixed(1)}h committed`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          {rows.map(({ person, bars }) => {
            const laneCount = Math.max(...bars.map((b) => b.lane)) + 1;
            return (
              <div key={person.id} className="flex items-start">
                <div className="flex w-[148px] shrink-0 items-center gap-2 pr-2">
                  <Avatar name={person.name} color={person.avatarColor} size={20} />
                  <span className="truncate text-xs text-ink-soft">{person.name}</span>
                </div>
                <div className="relative" style={{ width: gridWidth, height: laneCount * LANE_PX }}>
                  {bars.map((bar) => (
                    <Link
                      key={bar.taskId}
                      href={`/tasks/${bar.taskId}`}
                      className="absolute truncate rounded-md bg-brand px-1.5 text-[10px] leading-6 text-white hover:bg-brand-dark"
                      style={{
                        left: xFor(bar.start),
                        width: Math.max(DAY_PX - 4, widthFor(bar)),
                        top: bar.lane * LANE_PX,
                        height: LANE_PX - 4,
                      }}
                    >
                      {bar.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
