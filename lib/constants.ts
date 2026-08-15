import type { NudgeType } from "@/types/nudge";

// index 0 = Monday .. 6 = Sunday
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WORK_START_MIN = 9 * 60; // 540
export const WORK_END_MIN = 18 * 60; // 1080

export const NUDGE_TYPES: NudgeType[] = ["stretch", "hydrate", "eye_rest", "posture"];

export const NUDGE_META: Record<NudgeType, { icon: string; title: string; body: string }> = {
  stretch: {
    icon: "stretch",
    title: "Stretch break",
    body: "Stand up and stretch your arms, neck, and back for a minute.",
  },
  hydrate: {
    icon: "droplet",
    title: "Hydrate",
    body: "Grab a glass of water — you've been heads-down for a while.",
  },
  eye_rest: {
    icon: "eye",
    title: "Rest your eyes",
    body: "Look at something 20 feet away for 20 seconds.",
  },
  posture: {
    icon: "posture",
    title: "Check your posture",
    body: "Sit back, relax your shoulders, and reset your position.",
  },
};

export const NUDGE_SESSION_MINUTES = 50;
export const NUDGE_DAILY_CAP = 6;
export const NUDGE_TICK_MS = 180; // 1 simulated minute per tick
export const NUDGE_SNOOZE_MINUTES = 10;
export const QUIET_HOURS_START_MIN = 8 * 60; // 8am
export const QUIET_HOURS_END_MIN = 18 * 60; // 6pm

export interface Mood {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  body: string;
  light: string;
  frill: string;
  line: string;
  quote: string;
  attribution: string;
  kicker?: string;
}

export const MOODS: Mood[] = [
  {
    value: 1,
    label: "Awful",
    body: "#64748b",
    light: "#94a3b8",
    frill: "#475569",
    line: "#1e293b",
    quote: "It's okay to not be okay. Reach out — support is one message away.",
    attribution: "AxionHR Wellbeing Team",
  },
  {
    value: 2,
    label: "Low",
    body: "#60a5fa",
    light: "#93c5fd",
    frill: "#3b82f6",
    line: "#1e3a8a",
    quote: "Rough patches pass. Be a little gentler with yourself today.",
    attribution: "AxionHR Wellbeing Team",
  },
  {
    value: 3,
    label: "Okay",
    body: "#eab308",
    light: "#fde047",
    frill: "#ca8a04",
    line: "#713f12",
    quote: "Steady is good. Small wins still count.",
    attribution: "AxionHR Wellbeing Team",
  },
  {
    value: 4,
    label: "Good",
    body: "#2dd4bf",
    light: "#5eead4",
    frill: "#14b8a6",
    line: "#134e4a",
    quote: "Nice momentum — keep noticing what's working.",
    attribution: "AxionHR Wellbeing Team",
  },
  {
    value: 5,
    label: "Great",
    body: "#a855f7",
    light: "#d8b4fe",
    frill: "#9333ea",
    line: "#581c87",
    quote: "Fantastic! Bottle this feeling and share some of it around.",
    attribution: "AxionHR Wellbeing Team",
    kicker: "Consider giving a teammate kudos today — good moods are contagious.",
  },
];

export const KUDOS_TAGS = [
  "Great teammate",
  "Made my day",
  "Went above and beyond",
  "Really listened",
] as const;

export const KUDOS_PROGRESS_START = 5;
export const KUDOS_PROGRESS_CAP = 8;

export const KUDOS_HR_FLAGGED = [
  { team: "Engineering", note: "Recognized for stepping up during an on-call incident." },
  { team: "Support", note: "Recognized for going above and beyond with a difficult customer." },
];

export type TimelineKind = "meeting" | "deep_work" | "gap" | "high_stress";

export interface TimelineBlock {
  start: string;
  end: string;
  kind: TimelineKind;
  label: string;
}

export const FOCUS_TIMELINE: TimelineBlock[] = [
  { start: "9:00", end: "10:00", kind: "meeting", label: "Meeting" },
  { start: "10:00", end: "11:00", kind: "meeting", label: "Meeting" },
  { start: "11:00", end: "12:00", kind: "deep_work", label: "Deep work" },
  { start: "1:00", end: "2:00", kind: "gap", label: "Open" },
  { start: "2:00", end: "3:00", kind: "high_stress", label: "High stress" },
  { start: "3:00", end: "4:00", kind: "gap", label: "Open" },
];

export type WorkspaceState = "standard" | "focus" | "calm";

export const WORKSPACE_COPY: Record<
  WorkspaceState,
  { label: string; bullets: string[] }
> = {
  standard: {
    label: "Standard",
    bullets: [
      "Full navigation, notifications, and widgets visible",
      "All dashboard panels expanded",
      "Standard notification volume",
    ],
  },
  focus: {
    label: "Focus / Simplified",
    bullets: [
      "Non-essential panels collapsed",
      "Notifications batched and muted",
      "Single-column, distraction-reduced layout",
    ],
  },
  calm: {
    label: "Calm / Recovery",
    bullets: [
      "Muted color palette and reduced motion",
      "Meeting and message reminders paused",
      "Optional breathing prompt shown between tasks",
    ],
  },
};
