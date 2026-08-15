import type { Employee } from "@/types/employee";
import type { BurnoutBand, BurnoutScores } from "@/types/burnout";

function clamp(min: number, max: number, v: number): number {
  return Math.min(max, Math.max(min, v));
}

export function bandFor(composite: number): BurnoutBand {
  if (composite >= 75) return "critical";
  if (composite >= 50) return "high";
  if (composite >= 25) return "medium";
  return "low";
}

export type BurnoutInputs = Pick<
  Employee,
  "streakDays" | "meetingAvg" | "available" | "offHoursWeekly" | "daysSincePto" | "onPto"
>;

export function computeBurnout(e: BurnoutInputs): BurnoutScores {
  const streak = Math.min(100, e.streakDays * 8);
  const meeting = Math.min(100, (e.meetingAvg / e.available) * 100);
  const offHours = Math.min(100, (e.offHoursWeekly / 15) * 100);
  const ptoBase = Math.min(100, e.daysSincePto / 1.2);
  const pto = Math.min(
    100,
    ptoBase + (e.onPto && e.offHoursWeekly > 0 ? 30 : 0)
  );
  const composite = 0.3 * streak + 0.25 * meeting + 0.25 * offHours + 0.2 * pto;
  return { streak, meeting, offHours, pto, composite, band: bandFor(composite) };
}

export function dominantDriver(scores: BurnoutScores): {
  key: "streak" | "meeting" | "offHours" | "pto";
  label: string;
} {
  const entries: { key: "streak" | "meeting" | "offHours" | "pto"; label: string; value: number }[] = [
    { key: "streak", label: "a long work streak without a day off", value: scores.streak },
    { key: "meeting", label: "heavy meeting load relative to available hours", value: scores.meeting },
    { key: "offHours", label: "frequent after-hours messages", value: scores.offHours },
    { key: "pto", label: "time since their last PTO", value: scores.pto },
  ];
  entries.sort((a, b) => b.value - a.value);
  return { key: entries[0].key, label: entries[0].label };
}

export function seedFrom(str: string): number {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return sum;
}

export function trendFor(seedStr: string, end: number): number[] {
  const seed = seedFrom(seedStr);
  const out: number[] = [];
  for (let d = 0; d < 14; d++) {
    const wobble = Math.sin((d + seed) * 0.85) * 9;
    const value = clamp(2, 98, end - (13 - d) * 0.6 + wobble);
    out.push(value);
  }
  return out;
}

export function sparkPath(values: number[], width = 120, height = 36): string {
  const n = values.length;
  if (n === 0) return "";
  const stepX = n > 1 ? width / (n - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / 100) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
