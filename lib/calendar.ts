import { addDays, isoWeekday, isWeekend, type IsoDate } from "@/lib/date";
import { estimateOrDefault } from "@/lib/tasks";
import type { Priority } from "@/types/task";

/**
 * Pure calendar math for the P5 Calendar view — a deadline pile-up
 * detector, not a generic date picker. No dependency: ~60 lines of grid
 * math plus a load-banding function, both unit-tested in
 * lib/__tests__/calendar.test.ts.
 */

export interface CalendarCell {
  date: IsoDate;
  inMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

/** 6x7 grid (42 cells) for `year`/`month` (1-12), Monday-start weeks —
 *  matches lib/date.ts#isoWeekday's 1=Mon..7=Sun convention. Always 6 rows
 *  so the grid height never jumps between months. */
export function monthGrid(year: number, month: number, today: IsoDate): CalendarCell[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstWeekday = isoWeekday(first);
  const gridStart = addDays(first, -(firstWeekday - 1));
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      inMonth: date.startsWith(monthPrefix),
      isWeekend: isWeekend(date),
      isToday: date === today,
    });
  }
  return cells;
}

export type LoadBand = "none" | "light" | "busy" | "overloaded";

/** Bands committed hours due on one day into a tint: 0h is empty, under 4h
 *  is light, up to 8h (roughly one person-day) is a normal busy day,
 *  anything past that is a pile-up. */
export function loadBand(hours: number): LoadBand {
  if (hours <= 0) return "none";
  if (hours < 4) return "light";
  if (hours <= 8) return "busy";
  return "overloaded";
}

export interface CalendarTaskInput {
  due_date: IsoDate | null;
  done: boolean;
  priority: Priority;
  estimate_hours?: number | null;
}

/** Sums estimateOrDefault() over open tasks, grouped by due_date — what
 *  each calendar cell tints against. */
export function hoursDueByDate(tasks: CalendarTaskInput[]): Map<IsoDate, number> {
  const totals = new Map<IsoDate, number>();
  for (const t of tasks) {
    if (t.done || !t.due_date) continue;
    totals.set(t.due_date, (totals.get(t.due_date) ?? 0) + estimateOrDefault(t));
  }
  return totals;
}
