/**
 * P8 item 7: recovery guardrails.
 *
 * Small, blunt checks that fire in the moment rather than showing up in a
 * dashboard next quarter. The design rule throughout: a guardrail either
 * BLOCKS something clearly wrong (clocking in while signed off sick) or
 * NOTICES something out loud (ten hours on the clock) — it never nags. Two
 * of these are advisory precisely because a person working late may have an
 * excellent reason, and an app that argues with them just gets ignored.
 *
 * Pure and unit-tested; app/(app)/attendance/actions.ts enforces the
 * blocking one, components/shell/ClockWidget.tsx surfaces the advisory ones.
 */

export type GuardrailKind = "long_day" | "no_break" | "lone_weekend" | "on_pto";

export type GuardrailTone = "block" | "warn" | "notice";

export interface Guardrail {
  kind: GuardrailKind;
  tone: GuardrailTone;
  message: string;
}

/** Hours on the clock before a session is worth remarking on. */
export const LONG_DAY_HOURS = 10;
/** Continuous minutes worked before "you haven't taken a break" is fair. */
export const NO_BREAK_MINUTES = 4 * 60;

export interface SessionState {
  /** Minutes since clock-in. */
  elapsedMinutes: number;
  /** Minutes since the last break ended, or since clock-in if none taken. */
  minutesSinceBreak: number;
  /** Whether any break has been recorded in this session. */
  hasTakenBreak: boolean;
  /** True while the person is on a break right now — no point telling
   *  somebody to take a break during their break. */
  onBreakNow: boolean;
}

/**
 * Advisory guardrails for an open work session. Returns at most one of each
 * kind, most serious first, and deliberately returns nothing at all when
 * the person is currently on a break.
 */
export function sessionGuardrails(state: SessionState): Guardrail[] {
  if (state.onBreakNow) return [];
  const out: Guardrail[] = [];

  if (state.elapsedMinutes >= LONG_DAY_HOURS * 60) {
    const hours = Math.floor(state.elapsedMinutes / 60);
    out.push({
      kind: "long_day",
      tone: "warn",
      message: `You've been clocked in for ${hours} hours. Consider clocking out.`,
    });
  }

  if (state.minutesSinceBreak >= NO_BREAK_MINUTES) {
    const hours = Math.floor(state.minutesSinceBreak / 60);
    const minutes = state.minutesSinceBreak % 60;
    const span = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    out.push({
      kind: "no_break",
      tone: "notice",
      message: state.hasTakenBreak
        ? `${span} since your last break.`
        : `${span} in with no break recorded yet.`,
    });
  }

  return out;
}

export interface WeekendWorkInput {
  /** Employee ids on this person's team who logged any time on the date. */
  teammatesWhoWorked: string[];
  employeeId: string;
  teamSize: number;
}

/**
 * "You're the only person on your team who worked Saturday."
 *
 * Only fires when they are genuinely alone — with a second person it stops
 * being a signal about one individual's boundaries and becomes a fact about
 * the team's deadline, which is the burnout screen's job, not a nudge's.
 * Also requires a team of at least 3, since being 1 of 2 is not lonely
 * enough to be worth saying.
 */
export function loneWeekendGuardrail(input: WeekendWorkInput, dayLabel: string): Guardrail | null {
  if (input.teamSize < 3) return null;
  const others = input.teammatesWhoWorked.filter((id) => id !== input.employeeId);
  if (others.length > 0) return null;
  if (!input.teammatesWhoWorked.includes(input.employeeId)) return null;
  return {
    kind: "lone_weekend",
    tone: "notice",
    message: `You were the only person on your team who worked ${dayLabel}.`,
  };
}

/** The one hard block. Clocking in on approved leave is always a mistake —
 *  either the leave is wrong or the clock-in is, and both are worth
 *  stopping to check. */
export function ptoBlockMessage(returnDate: string | null): string {
  return returnDate
    ? `You're on approved leave until ${returnDate}. Cancel the leave first if you meant to work.`
    : "You're on approved leave today. Cancel the leave first if you meant to work.";
}
