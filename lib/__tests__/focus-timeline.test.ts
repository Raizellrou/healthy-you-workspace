import { describe, expect, it } from "vitest";
import { buildDayTimeline } from "@/lib/focus-timeline";

const TZ = "Asia/Manila"; // UTC+8

describe("buildDayTimeline", () => {
  it("marks the whole window as a gap with no sessions", () => {
    const blocks = buildDayTimeline({
      sessions: [],
      breaks: [],
      timezone: TZ,
      windowStartMin: 9 * 60,
      windowEndMin: 18 * 60,
      now: new Date("2026-08-19T10:00:00Z"),
    });
    expect(blocks).toEqual([{ startMin: 540, endMin: 1080, kind: "gap" }]);
  });

  it("splits worked time around a break", () => {
    // Clock in 09:00, break 12:00-12:30, clock out 17:00 (Manila).
    const blocks = buildDayTimeline({
      sessions: [{ clockIn: "2026-08-19T01:00:00Z", clockOut: "2026-08-19T09:00:00Z" }],
      breaks: [{ breakStart: "2026-08-19T04:00:00Z", breakEnd: "2026-08-19T04:30:00Z" }],
      timezone: TZ,
      windowStartMin: 9 * 60,
      windowEndMin: 18 * 60,
      now: new Date("2026-08-19T10:00:00Z"),
    });
    expect(blocks).toEqual([
      { startMin: 540, endMin: 720, kind: "worked" }, // 09:00-12:00
      { startMin: 720, endMin: 750, kind: "break" }, // 12:00-12:30
      { startMin: 750, endMin: 1020, kind: "worked" }, // 12:30-17:00
      { startMin: 1020, endMin: 1080, kind: "gap" }, // 17:00-18:00
    ]);
  });

  it("caps an open session at `now`, not the window end", () => {
    // Clocked in 09:00 Manila, still open at 11:00 Manila (03:00 UTC).
    const blocks = buildDayTimeline({
      sessions: [{ clockIn: "2026-08-19T01:00:00Z", clockOut: null }],
      breaks: [],
      timezone: TZ,
      windowStartMin: 9 * 60,
      windowEndMin: 18 * 60,
      now: new Date("2026-08-19T03:00:00Z"),
    });
    expect(blocks).toEqual([
      { startMin: 540, endMin: 660, kind: "worked" }, // 09:00-11:00
      { startMin: 660, endMin: 1080, kind: "gap" },
    ]);
  });

  it("clips a session that starts before the window", () => {
    const blocks = buildDayTimeline({
      sessions: [{ clockIn: "2026-08-19T00:00:00Z", clockOut: "2026-08-19T02:00:00Z" }], // 08:00-10:00 Manila
      breaks: [],
      timezone: TZ,
      windowStartMin: 9 * 60,
      windowEndMin: 18 * 60,
      now: new Date("2026-08-19T10:00:00Z"),
    });
    expect(blocks[0]).toEqual({ startMin: 540, endMin: 600, kind: "worked" });
  });
});
