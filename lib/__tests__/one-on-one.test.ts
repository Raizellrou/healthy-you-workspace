import { describe, it, expect } from "vitest";
import { buildAgenda, pressingCount, type AgendaInput } from "@/lib/one-on-one";

/** A person with nothing worth flagging — every threshold deliberately clear. */
const CALM: AgendaInput = {
  band: "low",
  score: 20,
  overdueTaskCount: 0,
  loadPct: 40,
  streakDays: 3,
  daysSincePto: 10,
  hasPtoHistory: true,
  noBreakDayCount: 0,
  weekendWorkDayCount: 0,
  offHoursEventCount: 0,
  recognisedRecently: true,
  openInterventionCount: 0,
};

function agendaFor(overrides: Partial<AgendaInput>) {
  return buildAgenda({ ...CALM, ...overrides });
}

describe("buildAgenda", () => {
  it("produces nothing for someone with no signals", () => {
    expect(buildAgenda(CALM)).toEqual([]);
  });

  it("flags a high band as watch and a critical band as urgent", () => {
    expect(agendaFor({ band: "high", score: 60 })[0]).toMatchObject({ kind: "burnout", severity: "watch" });
    expect(agendaFor({ band: "critical", score: 80 })[0]).toMatchObject({ kind: "burnout", severity: "urgent" });
  });

  it("ignores medium and low bands", () => {
    expect(agendaFor({ band: "medium", score: 40 })).toEqual([]);
  });

  it("only raises overdue tasks once there are at least 3", () => {
    expect(agendaFor({ overdueTaskCount: 2 })).toEqual([]);
    expect(agendaFor({ overdueTaskCount: 3 })[0]).toMatchObject({ kind: "overdue", severity: "watch" });
    expect(agendaFor({ overdueTaskCount: 6 })[0]).toMatchObject({ kind: "overdue", severity: "urgent" });
  });

  it("treats exactly 100% capacity as fine and anything above it as over", () => {
    expect(agendaFor({ loadPct: 100 })).toEqual([]);
    expect(agendaFor({ loadPct: 101 })[0]).toMatchObject({ kind: "capacity", severity: "watch" });
    expect(agendaFor({ loadPct: 130 })[0]).toMatchObject({ kind: "capacity", severity: "urgent" });
  });

  it("escalates a long streak at 14 days", () => {
    expect(agendaFor({ streakDays: 9 })).toEqual([]);
    expect(agendaFor({ streakDays: 10 })[0]).toMatchObject({ kind: "streak", severity: "watch" });
    expect(agendaFor({ streakDays: 14 })[0]).toMatchObject({ kind: "streak", severity: "urgent" });
  });

  it("escalates missing PTO at 90 days", () => {
    expect(agendaFor({ daysSincePto: 59 })).toEqual([]);
    expect(agendaFor({ daysSincePto: 60 })[0]).toMatchObject({ kind: "no_pto", severity: "watch" });
    expect(agendaFor({ daysSincePto: 90 })[0]).toMatchObject({ kind: "no_pto", severity: "urgent" });
  });

  // Regression: daysSincePto saturates at the 90-day lookback window when
  // there are no records at all, which made this fire at Urgent for every
  // single report a manager had. An absence of data is not a 90-day grind.
  it("never claims a duration when there is no PTO history at all", () => {
    const item = agendaFor({ hasPtoHistory: false, daysSincePto: 90 })[0];
    expect(item).toMatchObject({ kind: "no_pto", severity: "watch" });
    expect(item.headline).toBe("No approved leave on record.");
    expect(item.headline).not.toContain("90");
  });

  it("stays quiet about PTO with no history only if the record genuinely says so", () => {
    // With history and a recent break, nothing is raised at all.
    expect(agendaFor({ hasPtoHistory: true, daysSincePto: 5 })).toEqual([]);
  });

  it("raises recovery from either no-break days or weekend work", () => {
    expect(agendaFor({ noBreakDayCount: 3 })[0]).toMatchObject({ kind: "recovery" });
    expect(agendaFor({ weekendWorkDayCount: 2 })[0]).toMatchObject({ kind: "recovery" });
    expect(agendaFor({ noBreakDayCount: 2, weekendWorkDayCount: 1 })).toEqual([]);
  });

  it("mentions both recovery causes in one item when both apply", () => {
    const item = agendaFor({ noBreakDayCount: 4, weekendWorkDayCount: 3 })[0];
    expect(item.headline).toContain("4 long days");
    expect(item.headline).toContain("3 weekend days");
  });

  it("raises a recognition gap as info, not as something urgent", () => {
    const items = agendaFor({ recognisedRecently: false });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "recognition", severity: "info" });
  });

  it("raises still-open interventions", () => {
    expect(agendaFor({ openInterventionCount: 1 })[0].headline).toContain("1 suggested action is");
    expect(agendaFor({ openInterventionCount: 3 })[0].headline).toContain("3 suggested actions are");
  });

  it("sorts urgent before watch before info", () => {
    const items = agendaFor({
      recognisedRecently: false,
      overdueTaskCount: 3,
      band: "critical",
      score: 85,
    });
    expect(items.map((i) => i.severity)).toEqual(["urgent", "watch", "info"]);
  });

  it("caps the list so an agenda stays a conversation", () => {
    const items = agendaFor({
      band: "critical",
      score: 95,
      overdueTaskCount: 9,
      loadPct: 180,
      streakDays: 20,
      daysSincePto: 120,
      noBreakDayCount: 5,
      weekendWorkDayCount: 4,
      offHoursEventCount: 40,
      recognisedRecently: false,
      openInterventionCount: 2,
    });
    expect(items).toHaveLength(6);
    // The cap must drop the least important items, never an urgent one.
    expect(items.every((i) => i.severity !== "info")).toBe(true);
  });

  it("gives every item a prompt, not just a fact", () => {
    const items = agendaFor({ band: "high", score: 60, overdueTaskCount: 4, recognisedRecently: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.prompt.length).toBeGreaterThan(10);
    }
  });

  it("never includes a mood signal — mood is self-only by design", () => {
    const items = agendaFor({
      band: "critical",
      score: 99,
      overdueTaskCount: 9,
      streakDays: 30,
      recognisedRecently: false,
    });
    const serialised = JSON.stringify(items).toLowerCase();
    expect(serialised).not.toContain("mood");
    expect(items.map((i) => i.kind)).not.toContain("mood");
  });
});

describe("pressingCount", () => {
  it("counts urgent and watch but not info", () => {
    const items = buildAgenda({
      ...CALM,
      band: "critical",
      score: 90,
      overdueTaskCount: 4,
      recognisedRecently: false,
    });
    expect(items).toHaveLength(3);
    expect(pressingCount(items)).toBe(2);
  });

  it("is 0 for an empty agenda", () => {
    expect(pressingCount([])).toBe(0);
  });
});
