import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE,
  isQuietHours,
  isWithinWorkingHours,
  nextWorkStart,
  resolveDeliverAfter,
  type WorkSchedule,
} from "@/lib/schedule";

// Asia/Manila is UTC+8, no DST — makes the expected UTC instants exact and
// stable across the year.
const schedule: WorkSchedule = {
  timezone: "Asia/Manila",
  workdays: [1, 2, 3, 4, 5],
  startMin: 9 * 60,
  endMin: 18 * 60,
  quietStartMin: 20 * 60,
  quietEndMin: 8 * 60,
};

describe("isWithinWorkingHours", () => {
  it("is true inside the window on a workday", () => {
    // 2026-08-19 is Wednesday. 10:00 Manila = 02:00 UTC.
    expect(isWithinWorkingHours(schedule, new Date("2026-08-19T02:00:00Z"))).toBe(true);
  });

  it("is false before the window starts", () => {
    // 07:00 Manila = 2026-08-18T23:00:00Z.
    expect(isWithinWorkingHours(schedule, new Date("2026-08-18T23:00:00Z"))).toBe(false);
  });

  it("is false after the window ends", () => {
    // 19:00 Manila = 11:00 UTC.
    expect(isWithinWorkingHours(schedule, new Date("2026-08-19T11:00:00Z"))).toBe(false);
  });

  it("is false on a non-workday even during the window's hours", () => {
    // 2026-08-22 is Saturday. 10:00 Manila = 02:00 UTC.
    expect(isWithinWorkingHours(schedule, new Date("2026-08-22T02:00:00Z"))).toBe(false);
  });
});

describe("isQuietHours", () => {
  it("handles a window that wraps midnight", () => {
    // 21:00 Manila = 13:00 UTC — inside 20:00-08:00.
    expect(isQuietHours(schedule, new Date("2026-08-19T13:00:00Z"))).toBe(true);
    // 03:00 Manila = 2026-08-18T19:00:00Z — inside 20:00-08:00 (past midnight leg).
    expect(isQuietHours(schedule, new Date("2026-08-18T19:00:00Z"))).toBe(true);
    // 12:00 Manila = 04:00 UTC — outside the window.
    expect(isQuietHours(schedule, new Date("2026-08-19T04:00:00Z"))).toBe(false);
  });

  it("handles a window that does not wrap midnight", () => {
    const lunchQuiet: WorkSchedule = { ...schedule, quietStartMin: 12 * 60, quietEndMin: 13 * 60 };
    expect(isQuietHours(lunchQuiet, new Date("2026-08-19T04:30:00Z"))).toBe(true); // 12:30 Manila
    expect(isQuietHours(lunchQuiet, new Date("2026-08-19T02:00:00Z"))).toBe(false); // 10:00 Manila
  });
});

describe("nextWorkStart", () => {
  it("returns later today when called before the start time on a workday", () => {
    // 07:00 Manila Wed = 2026-08-18T23:00:00Z.
    const result = nextWorkStart(schedule, new Date("2026-08-18T23:00:00Z"));
    expect(result.toISOString()).toBe("2026-08-19T01:00:00.000Z"); // 09:00 Manila same day
  });

  it("rolls to tomorrow when called after today's start time", () => {
    // 19:00 Manila Wed = 11:00 UTC -> next start is Thu 09:00 Manila = 2026-08-20T01:00:00Z.
    const result = nextWorkStart(schedule, new Date("2026-08-19T11:00:00Z"));
    expect(result.toISOString()).toBe("2026-08-20T01:00:00.000Z");
  });

  it("skips the weekend", () => {
    // Friday evening 19:00 Manila = 2026-08-21T11:00:00Z -> Monday 09:00 Manila.
    const result = nextWorkStart(schedule, new Date("2026-08-21T11:00:00Z"));
    expect(result.toISOString()).toBe("2026-08-24T01:00:00.000Z");
  });

  it("resolves from anywhere in the weekend to Monday", () => {
    // Saturday 10:00 Manila = 2026-08-22T02:00:00Z.
    const result = nextWorkStart(schedule, new Date("2026-08-22T02:00:00Z"));
    expect(result.toISOString()).toBe("2026-08-24T01:00:00.000Z");
  });
});

describe("resolveDeliverAfter", () => {
  it("delivers immediately during working hours with immediate batching", () => {
    const instant = new Date("2026-08-19T02:00:00Z"); // 10:00 Manila Wed
    const result = resolveDeliverAfter(schedule, "immediate", instant);
    expect(result.deliverAfter).toEqual(instant);
    expect(result.heldReason).toBeNull();
  });

  it("holds an evening message for quiet hours regardless of batching mode", () => {
    const instant = new Date("2026-08-19T13:00:00Z"); // 21:00 Manila
    const result = resolveDeliverAfter(schedule, "hourly", instant);
    expect(result.heldReason).toBe("quiet_hours");
    expect(result.deliverAfter.toISOString()).toBe("2026-08-20T01:00:00.000Z"); // next day 09:00 Manila
  });

  it("holds a weekend message for quiet hours (not working hours)", () => {
    const instant = new Date("2026-08-22T02:00:00Z"); // Saturday 10:00 Manila
    const result = resolveDeliverAfter(schedule, "immediate", instant);
    expect(result.heldReason).toBe("quiet_hours");
    expect(result.deliverAfter.toISOString()).toBe("2026-08-24T01:00:00.000Z"); // Monday 09:00 Manila
  });

  it("rounds to the next hour boundary under hourly batching, during working hours", () => {
    const instant = new Date("2026-08-19T02:17:00Z"); // 10:17 Manila
    const result = resolveDeliverAfter(schedule, "hourly", instant);
    expect(result.heldReason).toBe("batched");
    expect(result.deliverAfter.toISOString()).toBe("2026-08-19T03:00:00.000Z");
  });

  it("defers to the next workday's start under daily_digest, even mid-day", () => {
    const instant = new Date("2026-08-19T02:00:00Z"); // 10:00 Manila Wed
    const result = resolveDeliverAfter(schedule, "daily_digest", instant);
    expect(result.heldReason).toBe("batched");
    expect(result.deliverAfter.toISOString()).toBe("2026-08-20T01:00:00.000Z"); // Thu 09:00 Manila
  });

  it("uses DEFAULT_SCHEDULE without throwing", () => {
    const result = resolveDeliverAfter(DEFAULT_SCHEDULE, "immediate", new Date());
    expect(result.deliverAfter instanceof Date).toBe(true);
  });
});
