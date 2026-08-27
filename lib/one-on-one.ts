import type { BurnoutBand } from "@/types/burnout";

/**
 * P8: the 1:1 agenda generator. Pure and unit-tested — it turns the signals
 * the rest of the app already computes into a short list of things worth
 * actually saying out loud, ranked so the most pressing item is first.
 *
 * Every signal here is one a manager can already see under 0010's
 * can_see_employee(). Individual mood is deliberately absent: mood_checkins
 * is self-only and every mood aggregate is n>=3 gated, so surfacing one
 * person's mood to their manager would break the promise that makes the
 * check-in honest in the first place. See 0021_one_on_ones.sql's header.
 */

export type AgendaSeverity = "info" | "watch" | "urgent";

export type AgendaKind =
  | "burnout"
  | "overdue"
  | "capacity"
  | "streak"
  | "no_pto"
  | "recovery"
  | "off_hours"
  | "recognition"
  | "intervention";

export interface AgendaItem {
  kind: AgendaKind;
  severity: AgendaSeverity;
  /** The fact, stated plainly. */
  headline: string;
  /** What to actually ask — an agenda item is useless without a question. */
  prompt: string;
}

export interface AgendaInput {
  band: BurnoutBand;
  score: number;
  overdueTaskCount: number;
  loadPct: number;
  streakDays: number;
  daysSincePto: number;
  /**
   * Whether any approved leave actually appears in the lookback window.
   *
   * This matters because lib/attendance.ts#daysSincePto returns the window
   * length itself (90) when it finds nothing — a saturating prior that is
   * right for burnout scoring but would otherwise make this agenda announce
   * "no time off taken in 90 days", at Urgent, about every person whose
   * leave history simply predates the system. Caught live: it fired
   * identically for all five of a manager's reports, which is precisely the
   * cry-wolf behaviour these thresholds exist to avoid.
   */
  hasPtoHistory: boolean;
  noBreakDayCount: number;
  weekendWorkDayCount: number;
  offHoursEventCount: number;
  /** Whether anyone has sent this person kudos in the recognition window. */
  recognisedRecently: boolean;
  /** Interventions raised for this person still sitting unresolved. */
  openInterventionCount: number;
}

const SEVERITY_RANK: Record<AgendaSeverity, number> = { urgent: 0, watch: 1, info: 2 };

/** Ten open items is a status report, not a conversation. */
const MAX_ITEMS = 6;

/**
 * Thresholds are deliberately conservative — an agenda that flags something
 * for everyone every week trains a manager to skim past it. Each one has to
 * clear a bar that a normal fortnight wouldn't.
 */
export function buildAgenda(input: AgendaInput): AgendaItem[] {
  const items: AgendaItem[] = [];

  if (input.band === "critical" || input.band === "high") {
    items.push({
      kind: "burnout",
      severity: input.band === "critical" ? "urgent" : "watch",
      headline: `Burnout risk is ${input.band} (${Math.round(input.score)}).`,
      prompt: "Ask how sustainable the last few weeks have felt before talking about anything else.",
    });
  }

  if (input.overdueTaskCount >= 3) {
    items.push({
      kind: "overdue",
      severity: input.overdueTaskCount >= 6 ? "urgent" : "watch",
      headline: `${input.overdueTaskCount} tasks are past their due date.`,
      prompt: "Work out which of these are genuinely still wanted — some may just need closing or reassigning.",
    });
  }

  if (input.loadPct > 100) {
    items.push({
      kind: "capacity",
      severity: input.loadPct >= 130 ? "urgent" : "watch",
      headline: `Committed work is ${Math.round(input.loadPct)}% of their weekly capacity.`,
      prompt: "Agree what moves off the list, not just what order it gets done in.",
    });
  }

  if (input.streakDays >= 10) {
    items.push({
      kind: "streak",
      severity: input.streakDays >= 14 ? "urgent" : "watch",
      headline: `${input.streakDays} consecutive working days without a day off.`,
      prompt: "Offer a specific day, not a general encouragement to rest.",
    });
  }

  if (!input.hasPtoHistory) {
    // Stated as a records fact, not a duration, and never Urgent — an
    // absence of data is not evidence of a 90-day grind.
    items.push({
      kind: "no_pto",
      severity: "watch",
      headline: "No approved leave on record.",
      prompt:
        "Check whether they have leave available and something is stopping them taking it — their history may also simply predate this system.",
    });
  } else if (input.daysSincePto >= 60) {
    items.push({
      kind: "no_pto",
      severity: input.daysSincePto >= 90 ? "urgent" : "watch",
      headline: `No time off taken in ${input.daysSincePto} days.`,
      prompt: "Ask whether something is blocking it — unused leave is usually a workload signal, not a preference.",
    });
  }

  if (input.noBreakDayCount >= 3 || input.weekendWorkDayCount >= 2) {
    const parts: string[] = [];
    if (input.noBreakDayCount >= 3) parts.push(`${input.noBreakDayCount} long days with no break logged`);
    if (input.weekendWorkDayCount >= 2) parts.push(`${input.weekendWorkDayCount} weekend days worked`);
    items.push({
      kind: "recovery",
      severity: "watch",
      headline: `Recovery time is thin: ${parts.join(", ")}.`,
      prompt: "Find out whether this is a deadline spike or how the job now works by default.",
    });
  }

  if (input.offHoursEventCount >= 10) {
    items.push({
      kind: "off_hours",
      severity: "watch",
      headline: `${input.offHoursEventCount} task actions happened outside working hours.`,
      prompt: "Check whether this is their choice or an expectation they have picked up from someone else.",
    });
  }

  if (input.openInterventionCount > 0) {
    items.push({
      kind: "intervention",
      severity: "watch",
      headline: `${input.openInterventionCount} suggested ${
        input.openInterventionCount === 1 ? "action is" : "actions are"
      } still open.`,
      prompt: "Close the loop on what was already raised before adding anything new.",
    });
  }

  if (!input.recognisedRecently) {
    items.push({
      kind: "recognition",
      severity: "info",
      headline: "Nobody has sent them kudos recently.",
      prompt: "Name something specific they did well — recognition gaps compound quietly.",
    });
  }

  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, MAX_ITEMS);
}

/** Headline count for a list row: how many items need attention, ignoring
 *  the purely informational ones. */
export function pressingCount(items: AgendaItem[]): number {
  return items.filter((i) => i.severity !== "info").length;
}
