import type { Employee } from "@/types/employee";
import type { BoundaryResult } from "@/types/boundary";
import { DAY_NAMES, WORK_START_MIN, WORK_END_MIN } from "@/lib/constants";
import { fmtClock } from "@/lib/time";

export function isWorkday(dayIndex: number): boolean {
  return dayIndex >= 0 && dayIndex <= 4; // Mon..Fri
}

export function nextWorkStart(
  dayIndex: number,
  minutes: number
): { day: number; minutes: number } {
  if (isWorkday(dayIndex) && minutes < WORK_START_MIN) {
    return { day: dayIndex, minutes: WORK_START_MIN };
  }
  let d = (dayIndex + 1) % 7;
  while (!isWorkday(d)) d = (d + 1) % 7;
  return { day: d, minutes: WORK_START_MIN };
}

export function evaluateBoundary(
  sender: Employee,
  recipient: Employee,
  day: number,
  timeMinutes: number,
  message: string
): BoundaryResult {
  if (sender.id === recipient.id) {
    return { status: "blocked", message: "Pick a different recipient" };
  }
  if (message.trim().length === 0) {
    return { status: "blocked", message: "Nothing to send yet" };
  }
  if (recipient.onPto) {
    return {
      status: "warned",
      message: `Will warn you first — back ${recipient.returnIn}`,
    };
  }
  if (isWorkday(day) && timeMinutes >= WORK_START_MIN && timeMinutes < WORK_END_MIN) {
    return { status: "delivered", message: "Delivers immediately" };
  }
  const next = nextWorkStart(day, timeMinutes);
  return {
    status: "delayed",
    message: `Held until ${DAY_NAMES[next.day]} ${fmtClock(next.minutes)}`,
  };
}
