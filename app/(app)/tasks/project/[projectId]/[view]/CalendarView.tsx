import Link from "next/link";
import { hoursDueByDate, loadBand, monthGrid, type LoadBand } from "@/lib/calendar";
import { todayInTz } from "@/lib/date";
import type { Task } from "@/types/task";

const BAND_CLASS: Record<LoadBand, string> = {
  none: "bg-surface",
  light: "bg-brand-soft/50",
  busy: "bg-[#FFD70030]",
  overloaded: "bg-[#FF8C7340]",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The deadline pile-up detector: each cell tints neutral -> amber -> red as
 *  summed estimate_hours due that day crosses ~8h (lib/calendar.ts#loadBand). */
export function CalendarView({
  tasks,
  year,
  month,
  projectId,
  view,
  search,
}: {
  tasks: Task[];
  year: number;
  month: number;
  projectId: string;
  view: string;
  search: string;
}) {
  const today = todayInTz();
  const cells = monthGrid(year, month, today);
  const hoursByDate = hoursDueByDate(tasks);

  const tasksByDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.done || !t.due_date) continue;
    const list = tasksByDate.get(t.due_date) ?? [];
    list.push(t);
    tasksByDate.set(t.due_date, list);
  }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  function monthHref(y: number, m: number): string {
    const params = new URLSearchParams(search);
    params.set("year", String(y));
    params.set("month", String(m));
    return `/tasks/project/${projectId}/${view}?${params.toString()}`;
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">{monthLabel}</div>
        <div className="flex gap-1">
          <Link
            href={monthHref(prev.year, prev.month)}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-2"
          >
            ‹ Prev
          </Link>
          <Link
            href={`/tasks/project/${projectId}/${view}${search}`}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-2"
          >
            Today
          </Link>
          <Link
            href={monthHref(next.year, next.month)}
            className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-2"
          >
            Next ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-1 pb-1 text-center font-medium text-ink-mute">
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const hours = hoursByDate.get(cell.date) ?? 0;
          const band = loadBand(hours);
          const dayTasks = tasksByDate.get(cell.date) ?? [];
          return (
            <div
              key={cell.date}
              className={`min-h-24 rounded-lg border p-1.5 ${cell.inMonth ? "border-line" : "border-transparent opacity-40"} ${BAND_CLASS[band]} ${cell.isToday ? "ring-1 ring-brand" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-ink-mute">{Number(cell.date.slice(8, 10))}</span>
                {hours > 0 ? <span className="text-[10px] font-semibold text-ink-soft">{hours}h</span> : null}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    className="block truncate rounded bg-surface px-1 py-0.5 text-[10px] text-ink-soft transition-colors hover:text-ink"
                  >
                    {t.title}
                  </Link>
                ))}
                {dayTasks.length > 3 ? <div className="text-[10px] text-ink-mute">+{dayTasks.length - 3} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
