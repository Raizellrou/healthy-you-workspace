import { describe, expect, it } from "vitest";
import { evaluateBoundary, isWorkday, nextWorkStart } from "@/lib/boundary";
import { WORK_END_MIN, WORK_START_MIN } from "@/lib/constants";
import type { Employee } from "@/types/employee";

/**
 * Characterization tests for `lib/boundary.ts` (must-not-modify per AGENTS.md).
 *
 * P6 introduces `lib/schedule.ts`, which generalises this logic to per-employee
 * working hours and timezones and returns real `Date`s instead of the abstract
 * 0=Mon..6=Sun index used here. These tests describe the behaviour the new
 * module has to reproduce for the single-global-schedule case, so the migration
 * can be checked rather than eyeballed.
 */

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "e1",
    name: "Test Person",
    team: "Engineering",
    role: "Engineer",
    email: "test@axionhr.test",
    worked: true,
    meeting: 0,
    offHours: 0,
    available: 8,
    meetingAvg: 0,
    streakDays: 0,
    daysSincePto: 0,
    onPto: false,
    offHoursWeekly: 0,
    returnIn: null,
    avatarColor: "#6f49a6",
    ...overrides,
  };
}

const sender = employee({ id: "sender", name: "Sender" });
const recipient = employee({ id: "recipient", name: "Recipient" });

const MID_MORNING = 10 * 60;
const LATE_EVENING = 22 * 60;

describe("isWorkday", () => {
  it("counts Monday through Friday only", () => {
    expect([0, 1, 2, 3, 4].every(isWorkday)).toBe(true);
    expect(isWorkday(5)).toBe(false); // Saturday
    expect(isWorkday(6)).toBe(false); // Sunday
  });

  it("rejects out-of-range indices rather than wrapping", () => {
    expect(isWorkday(-1)).toBe(false);
    expect(isWorkday(7)).toBe(false);
  });
});

describe("nextWorkStart", () => {
  it("stays on the same day when it is a workday before opening time", () => {
    expect(nextWorkStart(2, 7 * 60)).toEqual({ day: 2, minutes: WORK_START_MIN });
  });

  it("rolls to the next day once the workday has started", () => {
    expect(nextWorkStart(2, MID_MORNING)).toEqual({ day: 3, minutes: WORK_START_MIN });
    expect(nextWorkStart(2, LATE_EVENING)).toEqual({ day: 3, minutes: WORK_START_MIN });
  });

  it("skips the weekend from Friday evening", () => {
    expect(nextWorkStart(4, LATE_EVENING)).toEqual({ day: 0, minutes: WORK_START_MIN });
  });

  it("resolves to Monday from anywhere in the weekend", () => {
    expect(nextWorkStart(5, MID_MORNING)).toEqual({ day: 0, minutes: WORK_START_MIN });
    expect(nextWorkStart(6, 3 * 60)).toEqual({ day: 0, minutes: WORK_START_MIN });
  });
});

describe("evaluateBoundary", () => {
  it("blocks self-sends before anything else", () => {
    const result = evaluateBoundary(sender, sender, 0, MID_MORNING, "hello");
    expect(result.status).toBe("blocked");
    expect(result.message).toBe("Pick a different recipient");
  });

  it("blocks an empty or whitespace-only message", () => {
    expect(evaluateBoundary(sender, recipient, 0, MID_MORNING, "").status).toBe("blocked");
    expect(evaluateBoundary(sender, recipient, 0, MID_MORNING, "   \n ").status).toBe("blocked");
  });

  it("warns when the recipient is on PTO, even during working hours", () => {
    const onPto = employee({ id: "recipient", onPto: true });
    const result = evaluateBoundary(sender, onPto, 0, MID_MORNING, "hello");
    expect(result.status).toBe("warned");
    expect(result.message).toBe("Will warn you first — currently on PTO");
  });

  it("names the return date when the recipient has one", () => {
    // `returnIn` is hardcoded null in the query layer today because no PTO
    // return date is stored, so this branch is unreachable in production.
    // P4's `pto_requests` table revives it by supplying real data — without
    // editing this frozen module.
    const onPto = employee({ id: "recipient", onPto: true, returnIn: "Mon 12 May" });
    const result = evaluateBoundary(sender, onPto, 0, MID_MORNING, "hello");
    expect(result.status).toBe("warned");
    expect(result.message).toBe("Will warn you first — back Mon 12 May");
  });

  it("delivers inside working hours on a workday", () => {
    const result = evaluateBoundary(sender, recipient, 2, MID_MORNING, "hello");
    expect(result.status).toBe("delivered");
    expect(result.message).toBe("Delivers immediately");
  });

  it("treats the window as inclusive of the start and exclusive of the end", () => {
    expect(evaluateBoundary(sender, recipient, 2, WORK_START_MIN, "hi").status).toBe("delivered");
    expect(evaluateBoundary(sender, recipient, 2, WORK_START_MIN - 1, "hi").status).toBe("delayed");
    expect(evaluateBoundary(sender, recipient, 2, WORK_END_MIN - 1, "hi").status).toBe("delivered");
    expect(evaluateBoundary(sender, recipient, 2, WORK_END_MIN, "hi").status).toBe("delayed");
  });

  it("holds an evening message until the next morning", () => {
    const result = evaluateBoundary(sender, recipient, 2, LATE_EVENING, "hello");
    expect(result.status).toBe("delayed");
    expect(result.message).toBe("Held until Thursday 9:00 AM");
  });

  it("holds a Friday-night message until Monday", () => {
    const result = evaluateBoundary(sender, recipient, 4, LATE_EVENING, "hello");
    expect(result.status).toBe("delayed");
    expect(result.message).toBe("Held until Monday 9:00 AM");
  });

  it("holds a weekend message until Monday", () => {
    expect(evaluateBoundary(sender, recipient, 5, MID_MORNING, "hi").message).toBe(
      "Held until Monday 9:00 AM"
    );
    expect(evaluateBoundary(sender, recipient, 6, MID_MORNING, "hi").message).toBe(
      "Held until Monday 9:00 AM"
    );
  });
});
