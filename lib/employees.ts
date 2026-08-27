import type { Employee } from "@/types/employee";

const AVATAR_PALETTE = [
  "#0ea5e9",
  "#0369a1",
  "#7c3aed",
  "#0d9488",
  "#c026d3",
  "#4338ca",
  "#0891b2",
  "#9333ea",
] as const;

function emailFor(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ".") + "@petal.test";
}

function idFor(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

interface RawEmployee {
  name: string;
  team: string;
  role: string;
  worked: boolean;
  meeting: number;
  offHours: number;
  meetingAvg?: number;
  streakDays: number;
  daysSincePto: number;
  onPto: boolean;
  offHoursWeekly: number;
  returnIn: string | null;
}

const RAW_ROSTER: RawEmployee[] = [
  {
    name: "Amara Adeyemi",
    team: "Engineering",
    role: "Software Engineer",
    worked: true,
    meeting: 2.4,
    offHours: 1,
    streakDays: 1,
    daysSincePto: 15,
    onPto: false,
    offHoursWeekly: 2,
    returnIn: null,
  },
  {
    name: "Beatriz Haddad",
    team: "Design",
    role: "Product Designer",
    worked: true,
    meeting: 1.8,
    offHours: 0,
    streakDays: 3,
    daysSincePto: 20,
    onPto: false,
    offHoursWeekly: 1,
    returnIn: null,
  },
  {
    name: "Healthy Hannah",
    team: "Engineering",
    role: "Senior Engineer",
    worked: true,
    meeting: 2.1,
    offHours: 1,
    streakDays: 2,
    daysSincePto: 10,
    onPto: false,
    offHoursWeekly: 1,
    returnIn: null,
  },
  {
    name: "Warning Will",
    team: "Design",
    role: "Design Lead",
    worked: true,
    meeting: 4.6,
    offHours: 3,
    streakDays: 6,
    daysSincePto: 35,
    onPto: false,
    offHoursWeekly: 6,
    returnIn: null,
  },
  {
    name: "Risky Rita",
    team: "Sales",
    role: "Account Executive",
    worked: true,
    meeting: 6.2,
    offHours: 7,
    streakDays: 10,
    daysSincePto: 60,
    onPto: false,
    offHoursWeekly: 10,
    returnIn: null,
  },
  {
    name: "Burnout Bob",
    team: "Support",
    role: "Support Specialist",
    worked: false,
    meeting: 0,
    offHours: 4,
    meetingAvg: 5,
    streakDays: 14,
    daysSincePto: 90,
    onPto: true,
    offHoursWeekly: 14,
    returnIn: "3 days",
  },
  {
    name: "Caleb Okafor",
    team: "Sales",
    role: "SDR",
    worked: true,
    meeting: 3.0,
    offHours: 2,
    streakDays: 5,
    daysSincePto: 40,
    onPto: false,
    offHoursWeekly: 8,
    returnIn: null,
  },
  {
    name: "Dhruv Bianchi",
    team: "Support",
    role: "Support Lead",
    worked: false,
    meeting: 0,
    offHours: 0,
    meetingAvg: 0,
    streakDays: 0,
    daysSincePto: 5,
    onPto: true,
    offHoursWeekly: 0,
    returnIn: "tomorrow",
  },
];

export const EMPLOYEES: Employee[] = RAW_ROSTER.map((raw, i) => ({
  id: idFor(raw.name),
  name: raw.name,
  team: raw.team,
  role: raw.role,
  email: emailFor(raw.name),
  worked: raw.worked,
  meeting: raw.meeting,
  offHours: raw.offHours,
  available: 8,
  meetingAvg: raw.meetingAvg ?? raw.meeting,
  streakDays: raw.streakDays,
  daysSincePto: raw.daysSincePto,
  onPto: raw.onPto,
  offHoursWeekly: raw.offHoursWeekly,
  returnIn: raw.returnIn,
  avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
}));

export function getEmployee(id: string): Employee | undefined {
  return EMPLOYEES.find((e) => e.id === id);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export const TEAMS = Array.from(new Set(EMPLOYEES.map((e) => e.team)));
