import { describe, expect, it } from "vitest";
import { weightedMoodAverage } from "@/lib/mood";

describe("weightedMoodAverage", () => {
  it("weights each team's average by its checkin count", () => {
    const result = weightedMoodAverage([
      { avgMood: 4, checkinCount: 10 },
      { avgMood: 2, checkinCount: 1 },
    ]);
    // (4*10 + 2*1) / 11 = 3.818...
    expect(result).toBeCloseTo(3.818, 2);
  });

  it("excludes teams with no check-ins from both the sum and the total", () => {
    const result = weightedMoodAverage([
      { avgMood: 3, checkinCount: 5 },
      { avgMood: null, checkinCount: 0 },
    ]);
    expect(result).toBe(3);
  });

  it("returns null when no team has any check-ins", () => {
    expect(weightedMoodAverage([{ avgMood: null, checkinCount: 0 }])).toBeNull();
    expect(weightedMoodAverage([])).toBeNull();
  });
});
