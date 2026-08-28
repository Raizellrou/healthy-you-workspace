import type { BoundaryResult } from "@/types/boundary";
import type { WorkSchedule } from "@/lib/schedule";
import { isWithinWorkingHours, isQuietHours, nextWorkStart } from "@/lib/schedule";
import { fmtDate, type IsoDate } from "@/lib/date";

/**
 * P7's real replacement for the frozen lib/boundary.ts's abstract 0=Mon..6=Sun
 * index + global WORK_START_MIN/WORK_END_MIN — a real `Date` evaluated
 * against the recipient's actual schedule and timezone (lib/schedule.ts,
 * P6). lib/boundary.ts stays on disk untouched, per AGENTS.md; this
 * supersedes it without editing it.
 *
 * Checks both working hours and quiet hours, matching the policy
 * lib/notify.ts#resolveDeliverAfter applies to every real notification —
 * a customized quiet-hours window that falls inside working hours (an
 * evening shift, say) now delays here too, instead of only being honored
 * by the separate notification pipeline.
 */
export function evaluateBoundaryV2(params: {
  senderId: string;
  recipientId: string;
  recipientSchedule: WorkSchedule;
  recipientOnPto: boolean;
  recipientReturnDate: IsoDate | null;
  instant: Date;
  message: string;
}): BoundaryResult {
  if (params.senderId === params.recipientId) {
    return { status: "blocked", message: "Pick a different recipient" };
  }
  if (params.message.trim().length === 0) {
    return { status: "blocked", message: "Nothing to send yet" };
  }
  if (params.recipientOnPto) {
    return {
      status: "warned",
      message: params.recipientReturnDate
        ? `Will warn you first — back ${fmtDate(params.recipientReturnDate)}`
        : "Will warn you first — currently on PTO",
    };
  }
  if (
    isWithinWorkingHours(params.recipientSchedule, params.instant) &&
    !isQuietHours(params.recipientSchedule, params.instant)
  ) {
    return { status: "delivered", message: "Delivers immediately" };
  }
  const next = nextWorkStart(params.recipientSchedule, params.instant);
  return {
    status: "delayed",
    message: `Held until ${fmtInstant(next, params.recipientSchedule.timezone)}`,
  };
}

/** "Monday 9:00 AM" in the given timezone — for describing a resolved
 *  held-until instant back to the sender, who is very possibly in a
 *  different timezone than the recipient. */
export function fmtInstant(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}
