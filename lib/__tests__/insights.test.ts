import { describe, it, expect } from "vitest";
import {
  bandDistributionByTeam,
  capacityByTeam,
  ptoUtilization,
  recognitionCoverage,
  offHoursIndex,
  notificationHoldRate,
  type TeamBandRow,
} from "@/lib/insights";

function band(employeeId: string, team: string, b: TeamBandRow["band"], score: number): TeamBandRow {
  return { employeeId, team, band: b, score };
}

describe("bandDistributionByTeam", () => {
  it("counts each band per team and averages the score", () => {
    const result = bandDistributionByTeam([
      band("a", "Sales", "low", 20),
      band("b", "Sales", "high", 60),
      band("c", "Design", "low", 10),
    ]);
    const sales = result.find((r) => r.team === "Sales")!;
    expect(sales).toMatchObject({ low: 1, medium: 0, high: 1, critical: 0, total: 2, avgScore: 40, atRisk: 1 });
    expect(result.find((r) => r.team === "Design")).toMatchObject({ low: 1, total: 1, avgScore: 10, atRisk: 0 });
  });

  it("sorts worst-first by at-risk count, not alphabetically", () => {
    const result = bandDistributionByTeam([
      band("a", "Alpha", "low", 10),
      band("b", "Zulu", "critical", 90),
      band("c", "Zulu", "high", 60),
    ]);
    expect(result.map((r) => r.team)).toEqual(["Zulu", "Alpha"]);
  });

  it("breaks an at-risk tie with the average score", () => {
    const result = bandDistributionByTeam([
      band("a", "Alpha", "medium", 45),
      band("b", "Bravo", "medium", 30),
    ]);
    expect(result.map((r) => r.team)).toEqual(["Alpha", "Bravo"]);
  });

  it("returns an empty list for no rows", () => {
    expect(bandDistributionByTeam([])).toEqual([]);
  });
});

describe("capacityByTeam", () => {
  it("averages load and counts who is over capacity", () => {
    const result = capacityByTeam([
      { employeeId: "a", team: "Eng", loadPct: 120 },
      { employeeId: "b", team: "Eng", loadPct: 80 },
      { employeeId: "c", team: "Ops", loadPct: 50 },
    ]);
    expect(result[0]).toMatchObject({ team: "Eng", avgLoadPct: 100, memberCount: 2, overCapacityCount: 1 });
    expect(result[1]).toMatchObject({ team: "Ops", avgLoadPct: 50, overCapacityCount: 0 });
  });

  it("does not count exactly 100% as over capacity", () => {
    const result = capacityByTeam([{ employeeId: "a", team: "Eng", loadPct: 100 }]);
    expect(result[0].overCapacityCount).toBe(0);
  });
});

describe("ptoUtilization", () => {
  const people = [
    { id: "a", team: "Sales" },
    { id: "b", team: "Sales" },
    { id: "c", team: "Design" },
  ];

  it("counts weekdays only, not calendar days", () => {
    // 2026-08-21 is a Friday, 2026-08-24 a Monday — 4 calendar days, 2 weekdays.
    const result = ptoUtilization(
      [{ employeeId: "a", startDate: "2026-08-21", endDate: "2026-08-24", status: "approved" }],
      people,
      "2026-08-01",
      "2026-08-31"
    );
    expect(result.totalDays).toBe(2);
  });

  it("ignores requests that are not approved", () => {
    const result = ptoUtilization(
      [
        { employeeId: "a", startDate: "2026-08-03", endDate: "2026-08-03", status: "pending" },
        { employeeId: "b", startDate: "2026-08-04", endDate: "2026-08-04", status: "denied" },
      ],
      people,
      "2026-08-01",
      "2026-08-31"
    );
    expect(result.totalDays).toBe(0);
    expect(result.peopleWithPto).toBe(0);
  });

  it("clips a request straddling the window edge instead of dropping it", () => {
    // Mon 2026-07-27 .. Mon 2026-08-03, window starts 2026-08-01 (Sat).
    // In-window weekdays: Mon 3rd only.
    const result = ptoUtilization(
      [{ employeeId: "a", startDate: "2026-07-27", endDate: "2026-08-03", status: "approved" }],
      people,
      "2026-08-01",
      "2026-08-31"
    );
    expect(result.totalDays).toBe(1);
  });

  it("excludes a request entirely outside the window", () => {
    const result = ptoUtilization(
      [{ employeeId: "a", startDate: "2026-06-01", endDate: "2026-06-05", status: "approved" }],
      people,
      "2026-08-01",
      "2026-08-31"
    );
    expect(result.totalDays).toBe(0);
  });

  it("rolls days up per team and averages across the whole headcount", () => {
    const result = ptoUtilization(
      [{ employeeId: "a", startDate: "2026-08-03", endDate: "2026-08-04", status: "approved" }],
      people,
      "2026-08-01",
      "2026-08-31"
    );
    expect(result.totalDays).toBe(2);
    expect(result.peopleWithPto).toBe(1);
    expect(result.headcount).toBe(3);
    expect(result.avgDaysPerPerson).toBeCloseTo(0.7, 1);
    expect(result.byTeam.find((t) => t.team === "Sales")).toMatchObject({ days: 2, memberCount: 2 });
    expect(result.byTeam.find((t) => t.team === "Design")).toMatchObject({ days: 0, memberCount: 1 });
  });
});

describe("recognitionCoverage", () => {
  const people = [
    { id: "a", name: "Ada", team: "Eng", avatarColor: "#111111" },
    { id: "b", name: "Bo", team: "Eng", avatarColor: "#222222" },
    { id: "c", name: "Cy", team: "Ops", avatarColor: "#333333" },
  ];

  it("counts distinct recipients, not kudos volume", () => {
    const result = recognitionCoverage(
      [
        { toEmployeeId: "a", createdAt: "2026-08-10T00:00:00Z" },
        { toEmployeeId: "a", createdAt: "2026-08-11T00:00:00Z" },
        { toEmployeeId: "a", createdAt: "2026-08-12T00:00:00Z" },
      ],
      people,
      "2026-08-01T00:00:00Z"
    );
    expect(result.coveredCount).toBe(1);
    expect(result.coveragePct).toBe(33);
    expect(result.drought.map((d) => d.name)).toEqual(["Bo", "Cy"]);
  });

  it("ignores kudos older than the window", () => {
    const result = recognitionCoverage(
      [{ toEmployeeId: "a", createdAt: "2026-07-01T00:00:00Z" }],
      people,
      "2026-08-01T00:00:00Z"
    );
    expect(result.coveredCount).toBe(0);
    expect(result.drought).toHaveLength(3);
  });

  it("ignores kudos with no recipient", () => {
    const result = recognitionCoverage(
      [{ toEmployeeId: null, createdAt: "2026-08-10T00:00:00Z" }],
      people,
      "2026-08-01T00:00:00Z"
    );
    expect(result.coveredCount).toBe(0);
  });

  it("reports full coverage with an empty drought list", () => {
    const result = recognitionCoverage(
      people.map((p) => ({ toEmployeeId: p.id, createdAt: "2026-08-10T00:00:00Z" })),
      people,
      "2026-08-01T00:00:00Z"
    );
    expect(result.coveragePct).toBe(100);
    expect(result.drought).toEqual([]);
  });
});

describe("offHoursIndex", () => {
  it("computes the share of off-hours activity", () => {
    const result = offHoursIndex([
      { isOffHours: true },
      { isOffHours: false },
      { isOffHours: false },
      { isOffHours: false },
    ]);
    expect(result).toEqual({ offHoursEvents: 1, totalEvents: 4, ratePct: 25 });
  });

  it("returns 0 rather than dividing by zero when there is no activity", () => {
    expect(offHoursIndex([])).toEqual({ offHoursEvents: 0, totalEvents: 0, ratePct: 0 });
  });
});

describe("notificationHoldRate", () => {
  it("treats 'delivered' as not held and sorts the breakdown by volume", () => {
    const result = notificationHoldRate([
      { heldReason: "delivered", count: 6 },
      { heldReason: "quiet_hours", count: 3 },
      { heldReason: "focus_session", count: 1 },
    ]);
    expect(result.total).toBe(10);
    expect(result.held).toBe(4);
    expect(result.heldPct).toBe(40);
    expect(result.breakdown.map((b) => b.reason)).toEqual(["delivered", "quiet_hours", "focus_session"]);
    expect(result.breakdown[1].label).toBe("Quiet hours");
  });

  it("handles an empty result set", () => {
    expect(notificationHoldRate([])).toMatchObject({ total: 0, held: 0, heldPct: 0, breakdown: [] });
  });

  it("passes an unknown reason through as its own label rather than dropping it", () => {
    const result = notificationHoldRate([{ heldReason: "some_future_reason", count: 2 }]);
    expect(result.breakdown[0]).toMatchObject({ reason: "some_future_reason", label: "some_future_reason" });
    expect(result.held).toBe(2);
  });
});
