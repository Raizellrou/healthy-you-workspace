/**
 * P8: the intervention engine's pure half. Maps a dominant burnout driver
 * (lib/burnout-signals.ts#dominantDriverV2's `key`) to a concrete, trackable
 * action type — the piece that turns "driven mainly by X" into something a
 * manager can actually click. What each action_type does at write time
 * lives in app/(app)/burnout/actions.ts; this module only decides which
 * one a driver maps to and how to describe it.
 */

export type InterventionDriverKey = "streak" | "meeting" | "offHours" | "pto" | "taskLoad" | "overdue" | "recovery";

export type InterventionActionType =
  | "schedule_pto"
  | "reduce_meetings"
  | "strict_quiet_hours"
  | "rebalance_tasks"
  | "resolve_overdue"
  | "general_checkin";

export interface InterventionSpec {
  actionType: InterventionActionType;
  label: string;
  description: string;
  /** True for the one case (schedule_pto) that performs a real write the
   *  moment a manager/HR creates it — a pending PTO request, no separate
   *  accept step needed since it still requires approval like any other.
   *  Every other action_type stays a tracked suggestion until the subject
   *  (or their manager) resolves it. */
  immediate: boolean;
}

const DRIVER_SPECS: Record<InterventionDriverKey, InterventionSpec> = {
  streak: {
    actionType: "schedule_pto",
    label: "Schedule a day off",
    description: "Pre-fills a pending PTO request for their next workday to break the streak.",
    immediate: true,
  },
  pto: {
    actionType: "schedule_pto",
    label: "Schedule a day off",
    description: "It's been a while since their last time off — pre-fills a pending PTO request.",
    immediate: true,
  },
  meeting: {
    actionType: "reduce_meetings",
    label: "Review recurring meetings",
    description: "Flags a conversation about declining or shortening recurring meetings.",
    immediate: false,
  },
  offHours: {
    actionType: "strict_quiet_hours",
    label: "Enable strict quiet hours",
    description: "Suggests blocking notifications outside work hours. They apply it themselves.",
    immediate: false,
  },
  recovery: {
    actionType: "strict_quiet_hours",
    label: "Protect recovery time",
    description: "Suggests blocking notifications outside work hours. They apply it themselves.",
    immediate: false,
  },
  taskLoad: {
    actionType: "rebalance_tasks",
    label: "Rebalance their workload",
    description: "Flags for a look at the workload rebalancer to move tasks to teammates with headroom.",
    immediate: false,
  },
  overdue: {
    actionType: "resolve_overdue",
    label: "Clear overdue tasks",
    description: "Flags their overdue tasks for triage — reassign, reschedule, or drop.",
    immediate: false,
  },
};

const GENERAL_SPEC: InterventionSpec = {
  actionType: "general_checkin",
  label: "Flag for a check-in",
  description: "Tracks that this was raised, without a specific automated action.",
  immediate: false,
};

/** Never throws — an unrecognized driver key (there shouldn't be one, but
 *  this crosses a client/server boundary) degrades to a generic tracked
 *  check-in rather than failing the whole panel. */
export function interventionFor(driverKey: string): InterventionSpec {
  return DRIVER_SPECS[driverKey as InterventionDriverKey] ?? GENERAL_SPEC;
}
