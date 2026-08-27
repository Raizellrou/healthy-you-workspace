import { describe, it, expect } from "vitest";
import {
  sessionGuardrails,
  loneWeekendGuardrail,
  ptoBlockMessage,
  LONG_DAY_HOURS,
  NO_BREAK_MINUTES,
  type SessionState,
} from "@/lib/guardrails";

const FRESH: SessionState = {
  elapsedMinutes: 30,
  minutesSinceBreak: 30,
  hasTakenBreak: false,
  onBreakNow: false,
};

function state(overrides: Partial<SessionState>): SessionState {
  return { ...FRESH, ...overrides };
}

describe("sessionGuardrails", () => {
  it("says nothing early in a session", () => {
    expect(sessionGuardrails(FRESH)).toEqual([]);
  });

  it("warns once the day passes the long-day threshold", () => {
    const below = sessionGuardrails(state({ elapsedMinutes: LONG_DAY_HOURS * 60 - 1 }));
    expect(below.some((g) => g.kind === "long_day")).toBe(false);

    const at = sessionGuardrails(state({ elapsedMinutes: LONG_DAY_HOURS * 60 }));
    expect(at.find((g) => g.kind === "long_day")).toMatchObject({ tone: "warn" });
    expect(at[0].message).toContain("10 hours");
  });

  it("notices a long stretch with no break", () => {
    const g = sessionGuardrails(state({ minutesSinceBreak: NO_BREAK_MINUTES, elapsedMinutes: NO_BREAK_MINUTES }));
    const noBreak = g.find((x) => x.kind === "no_break")!;
    expect(noBreak.tone).toBe("notice");
    expect(noBreak.message).toContain("no break recorded yet");
  });

  it("words it differently once a break has already been taken", () => {
    const g = sessionGuardrails(
      state({ minutesSinceBreak: 250, elapsedMinutes: 400, hasTakenBreak: true })
    );
    const noBreak = g.find((x) => x.kind === "no_break")!;
    expect(noBreak.message).toContain("since your last break");
    expect(noBreak.message).toContain("4h 10m");
  });

  it("stays silent while the person is actually on a break", () => {
    expect(
      sessionGuardrails(state({ elapsedMinutes: 900, minutesSinceBreak: 900, onBreakNow: true }))
    ).toEqual([]);
  });

  it("can raise both at once, most serious first", () => {
    const g = sessionGuardrails(state({ elapsedMinutes: 700, minutesSinceBreak: 700 }));
    expect(g.map((x) => x.kind)).toEqual(["long_day", "no_break"]);
  });
});

describe("loneWeekendGuardrail", () => {
  const base = { employeeId: "me", teamSize: 5 };

  it("fires when they worked and nobody else on the team did", () => {
    const g = loneWeekendGuardrail({ ...base, teammatesWhoWorked: ["me"] }, "Saturday");
    expect(g).toMatchObject({ kind: "lone_weekend", tone: "notice" });
    expect(g!.message).toContain("Saturday");
  });

  it("stays quiet when a teammate also worked — that's a team deadline, not a boundary problem", () => {
    expect(loneWeekendGuardrail({ ...base, teammatesWhoWorked: ["me", "other"] }, "Saturday")).toBeNull();
  });

  it("stays quiet when the person themselves did not work", () => {
    expect(loneWeekendGuardrail({ ...base, teammatesWhoWorked: ["other"] }, "Saturday")).toBeNull();
    expect(loneWeekendGuardrail({ ...base, teammatesWhoWorked: [] }, "Saturday")).toBeNull();
  });

  it("stays quiet on a team too small for 'the only one' to mean anything", () => {
    expect(loneWeekendGuardrail({ employeeId: "me", teamSize: 2, teammatesWhoWorked: ["me"] }, "Sunday")).toBeNull();
  });
});

describe("ptoBlockMessage", () => {
  it("names the return date when known", () => {
    expect(ptoBlockMessage("Mon 31 Aug")).toContain("until Mon 31 Aug");
  });

  it("still refuses clearly without one", () => {
    expect(ptoBlockMessage(null)).toContain("approved leave today");
  });
});
