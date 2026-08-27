import { describe, it, expect } from "vitest";
import {
  freeBlocks,
  longestFreeBlock,
  shapeOfDay,
  summarisePerson,
  auditSeries,
  noMeetingDayOptions,
  findMutualGap,
  DEEP_WORK_MINUTES,
} from "@/lib/meetings";

const DAY_START = 540; // 09:00
const DAY_END = 1080; // 18:00

describe("freeBlocks", () => {
  it("returns the whole day when there are no meetings", () => {
    expect(freeBlocks([], DAY_START, DAY_END)).toEqual([
      { startMin: DAY_START, endMin: DAY_END, minutes: 540 },
    ]);
  });

  it("splits the day around a single meeting", () => {
    const gaps = freeBlocks([{ startMin: 600, endMin: 660 }], DAY_START, DAY_END);
    expect(gaps).toEqual([
      { startMin: 540, endMin: 600, minutes: 60 },
      { startMin: 660, endMin: 1080, minutes: 420 },
    ]);
  });

  it("merges overlapping meetings so time is never subtracted twice", () => {
    const gaps = freeBlocks(
      [
        { startMin: 600, endMin: 700 },
        { startMin: 650, endMin: 720 },
      ],
      DAY_START,
      DAY_END
    );
    expect(gaps).toEqual([
      { startMin: 540, endMin: 600, minutes: 60 },
      { startMin: 720, endMin: 1080, minutes: 360 },
    ]);
  });

  it("treats back-to-back meetings as one uninterrupted stretch", () => {
    const gaps = freeBlocks(
      [
        { startMin: 600, endMin: 630 },
        { startMin: 630, endMin: 660 },
      ],
      DAY_START,
      DAY_END
    );
    expect(gaps).toHaveLength(2);
    expect(gaps[1]).toEqual({ startMin: 660, endMin: 1080, minutes: 420 });
  });

  it("clips meetings that spill outside working hours", () => {
    const gaps = freeBlocks([{ startMin: 300, endMin: 600 }], DAY_START, DAY_END);
    expect(gaps).toEqual([{ startMin: 600, endMin: 1080, minutes: 480 }]);
  });

  it("returns nothing when meetings cover the entire day", () => {
    expect(freeBlocks([{ startMin: 400, endMin: 1200 }], DAY_START, DAY_END)).toEqual([]);
  });

  it("returns nothing for a zero-length or inverted day", () => {
    expect(freeBlocks([], 600, 600)).toEqual([]);
    expect(freeBlocks([], 700, 600)).toEqual([]);
  });
});

describe("longestFreeBlock", () => {
  it("finds the biggest gap, not the first", () => {
    const blocks = [
      { startMin: 600, endMin: 630 },
      { startMin: 700, endMin: 730 },
    ];
    expect(longestFreeBlock(blocks, DAY_START, DAY_END)).toBe(350); // 730 -> 1080
  });

  it("is 0 when the day is fully booked", () => {
    expect(longestFreeBlock([{ startMin: 0, endMin: 1440 }], DAY_START, DAY_END)).toBe(0);
  });
});

describe("shapeOfDay", () => {
  it("flags a day with a long clear run as deep-work capable", () => {
    const shape = shapeOfDay("2026-08-20", [{ startMin: 600, endMin: 660 }], DAY_START, DAY_END);
    expect(shape.hasDeepWorkBlock).toBe(true);
    expect(shape.longestFreeMinutes).toBe(420);
    expect(shape.meetingMinutes).toBe(60);
    expect(shape.meetingCount).toBe(1);
  });

  it("flags a fragmented day with no run at all, even on modest total load", () => {
    // Six 30-minute meetings every 90 minutes leaves only 60-minute gaps:
    // three hours of meetings, and nowhere to actually think.
    const blocks = [540, 630, 720, 810, 900, 990].map((s) => ({ startMin: s, endMin: s + 30 }));
    const shape = shapeOfDay("2026-08-20", blocks, DAY_START, DAY_END);
    expect(shape.meetingMinutes).toBe(180);
    expect(shape.longestFreeMinutes).toBeLessThan(DEEP_WORK_MINUTES);
    expect(shape.hasDeepWorkBlock).toBe(false);
  });

  it("does not double-count a double-booked hour", () => {
    const shape = shapeOfDay(
      "2026-08-20",
      [
        { startMin: 600, endMin: 660 },
        { startMin: 600, endMin: 660 },
      ],
      DAY_START,
      DAY_END
    );
    expect(shape.meetingMinutes).toBe(60);
  });
});

describe("summarisePerson", () => {
  const person = { employeeId: "a", name: "Ada", team: "Eng", avatarColor: "#111" };

  it("counts days without a deep-work block", () => {
    const days = [
      shapeOfDay("2026-08-17", [], DAY_START, DAY_END),
      shapeOfDay("2026-08-18", [{ startMin: 0, endMin: 1440 }], DAY_START, DAY_END),
    ];
    const summary = summarisePerson(person, days);
    expect(summary.workingDays).toBe(2);
    expect(summary.daysWithoutDeepWork).toBe(1);
    expect(summary.deepWorkDayPct).toBe(50);
  });

  it("handles an empty window without dividing by zero", () => {
    expect(summarisePerson(person, [])).toMatchObject({
      workingDays: 0,
      daysWithoutDeepWork: 0,
      deepWorkDayPct: 0,
      meetingHours: 0,
    });
  });
});

describe("auditSeries", () => {
  it("ranks by person-hours, not by duration", () => {
    const audit = auditSeries([
      // Monthly 2h review, 3 people, 1 occurrence = 6 person-hours.
      { seriesId: "review", title: "Monthly review", startMin: 600, endMin: 720, attendeeCount: 3, occurrences: 1 },
      // Weekly 30m standup, 12 people, 4 occurrences = 24 person-hours.
      { seriesId: "standup", title: "Standup", startMin: 540, endMin: 570, attendeeCount: 12, occurrences: 4 },
    ]);
    expect(audit[0]).toMatchObject({ seriesId: "standup", personHours: 24, rank: 1 });
    expect(audit[1]).toMatchObject({ seriesId: "review", personHours: 6, rank: 2 });
  });

  it("returns an empty list for no series", () => {
    expect(auditSeries([])).toEqual([]);
  });
});

describe("findMutualGap", () => {
  const day = (date: string, blocksA: { startMin: number; endMin: number }[], blocksB: typeof blocksA) => ({
    date,
    blocksA,
    blocksB,
  });

  it("finds a slot free for both, not just for one", () => {
    // A is busy all morning, B all afternoon; only 13:00-14:00 suits both.
    const found = findMutualGap(
      [day("2026-08-24", [{ startMin: 540, endMin: 780 }], [{ startMin: 840, endMin: 1080 }])],
      DAY_START,
      DAY_END,
      30
    );
    expect(found).toEqual({ date: "2026-08-24", startMin: 780, endMin: 810 });
  });

  it("rolls to the next day when today has no window big enough", () => {
    const found = findMutualGap(
      [
        day("2026-08-24", [{ startMin: 0, endMin: 1440 }], []),
        day("2026-08-25", [{ startMin: 540, endMin: 600 }], []),
      ],
      DAY_START,
      DAY_END,
      60
    );
    expect(found?.date).toBe("2026-08-25");
    expect(found?.startMin).toBe(600);
  });

  it("respects a minimum length rather than offering a useless sliver", () => {
    // Only a 20-minute window exists; asking for 30 must find nothing.
    const blocks = [
      { startMin: 540, endMin: 700 },
      { startMin: 720, endMin: 1080 },
    ];
    expect(findMutualGap([day("2026-08-24", blocks, [])], DAY_START, DAY_END, 30)).toBeNull();
    expect(findMutualGap([day("2026-08-24", blocks, [])], DAY_START, DAY_END, 20)).not.toBeNull();
  });

  it("never proposes a time earlier than the floor on the first day", () => {
    const found = findMutualGap([day("2026-08-24", [], [])], DAY_START, DAY_END, 30, 900);
    expect(found?.startMin).toBe(900);
  });

  it("applies the floor only to the first day", () => {
    const found = findMutualGap(
      [day("2026-08-24", [{ startMin: 0, endMin: 1440 }], []), day("2026-08-25", [], [])],
      DAY_START,
      DAY_END,
      30,
      1000
    );
    expect(found).toEqual({ date: "2026-08-25", startMin: DAY_START, endMin: DAY_START + 30 });
  });

  it("returns null when both calendars are solid across every day offered", () => {
    const full = [{ startMin: 0, endMin: 1440 }];
    expect(
      findMutualGap([day("2026-08-24", full, []), day("2026-08-25", [], full)], DAY_START, DAY_END, 30)
    ).toBeNull();
  });

  it("returns null for no days at all", () => {
    expect(findMutualGap([], DAY_START, DAY_END, 30)).toBeNull();
  });
});

describe("noMeetingDayOptions", () => {
  it("ranks the quietest weekday first and always returns all five", () => {
    const options = noMeetingDayOptions([
      { weekday: 1, meetingMinutes: 600, employeeId: "a", seriesId: "s1" },
      { weekday: 3, meetingMinutes: 60, employeeId: "a", seriesId: "s2" },
      { weekday: 3, meetingMinutes: 60, employeeId: "b", seriesId: "s2" },
    ]);
    expect(options).toHaveLength(5);
    expect(options[0].meetingHours).toBe(0);
    const wed = options.find((o) => o.weekday === 3)!;
    expect(wed).toMatchObject({ label: "Wednesday", meetingHours: 2, affectedPeople: 2, seriesToMove: 1 });
  });

  it("ignores weekend rows", () => {
    const options = noMeetingDayOptions([
      { weekday: 6, meetingMinutes: 600, employeeId: "a", seriesId: null },
      { weekday: 7, meetingMinutes: 600, employeeId: "a", seriesId: null },
    ]);
    expect(options.every((o) => o.meetingHours === 0)).toBe(true);
  });

  it("counts a one-off meeting as affecting nobody's series", () => {
    const options = noMeetingDayOptions([
      { weekday: 2, meetingMinutes: 120, employeeId: "a", seriesId: null },
    ]);
    expect(options.find((o) => o.weekday === 2)).toMatchObject({ seriesToMove: 0, affectedPeople: 1 });
  });
});
