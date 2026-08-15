export type BurnoutBand = "low" | "medium" | "high" | "critical";

export interface BurnoutScores {
  streak: number;
  meeting: number;
  offHours: number;
  pto: number;
  composite: number;
  band: BurnoutBand;
}

export type SortKey =
  | "name"
  | "composite"
  | "band"
  | "streakDays"
  | "meeting"
  | "offHours"
  | "daysSincePto";

export type SortDirection = "asc" | "desc";
