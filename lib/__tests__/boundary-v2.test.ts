import { describe, expect, it } from "vitest";
import { evaluateBoundaryV2, fmtInstant } from "@/lib/boundary-v2";
import type { WorkSchedule } from "@/lib/schedule";

// Asia/Manila is UTC+8, no DST.
const schedule: WorkSchedule = {
  timezone: "Asia/Manila",
  workdays: [1, 2, 3, 4, 5],
  startMin: 9 * 60,
  endMin: 18 * 60,
  quietStartMin: 20 * 60,
  quietEndMin: 8 * 60,
};

const base = {
  senderId: "sender-1",
  recipientId: "recipient-1",
  recipientSchedule: schedule,
  recipientOnPto: false,
  recipientReturnDate: null,
  message: "Hey, following up",
};

describe("evaluateBoundaryV2", () => {
  it("blocks sending to yourself", () => {
    const result = evaluateBoundaryV2({
      ...base,
      recipientId: "sender-1",
      instant: new Date("2026-08-19T02:00:00Z"),
    });
    expect(result.status).toBe("blocked");
  });

  it("blocks an empty message", () => {
    const result = evaluateBoundaryV2({ ...base, message: "   ", instant: new Date("2026-08-19T02:00:00Z") });
    expect(result.status).toBe("blocked");
  });

  it("delivers immediately inside the recipient's working hours", () => {
    // 2026-08-19 is Wednesday, 10:00 Manila = 02:00 UTC.
    const result = evaluateBoundaryV2({ ...base, instant: new Date("2026-08-19T02:00:00Z") });
    expect(result.status).toBe("delivered");
  });

  it("delays outside working hours, naming the recipient's next work start", () => {
    // 21:00 Manila Wednesday = 13:00 UTC — after hours.
    const result = evaluateBoundaryV2({ ...base, instant: new Date("2026-08-19T13:00:00Z") });
    expect(result.status).toBe("delayed");
    expect(result.message).toContain("Thursday");
  });

  it("warns instead of delaying when the recipient is on PTO", () => {
    const result = evaluateBoundaryV2({
      ...base,
      recipientOnPto: true,
      recipientReturnDate: "2026-08-24",
      instant: new Date("2026-08-19T02:00:00Z"),
    });
    expect(result.status).toBe("warned");
    expect(result.message).toContain("back");
  });

  it("warns without a return date when none is known", () => {
    const result = evaluateBoundaryV2({
      ...base,
      recipientOnPto: true,
      recipientReturnDate: null,
      instant: new Date("2026-08-19T02:00:00Z"),
    });
    expect(result.status).toBe("warned");
    expect(result.message).toContain("currently on PTO");
  });
});

describe("fmtInstant", () => {
  it("renders a weekday and time in the given timezone", () => {
    // 2026-08-24T01:00:00Z = Monday 09:00 in Asia/Manila.
    const text = fmtInstant(new Date("2026-08-24T01:00:00Z"), "Asia/Manila");
    expect(text).toContain("Monday");
    expect(text).toMatch(/9:00/);
  });
});
