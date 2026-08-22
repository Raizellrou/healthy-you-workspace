import { describe, expect, it } from "vitest";
import { canSee, isHr, isManagerOf, scopeLabel, visibleTo } from "@/lib/authz";
import type { Person, Team } from "@/types/person";

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: "p1",
    name: "Test Person",
    email: "test@axionhr.test",
    team: "Engineering",
    teamId: "team-eng",
    appRole: "employee",
    timezone: "Asia/Manila",
    weeklyCapacityHours: 40,
    avatarColor: "#6f49a6",
    ...overrides,
  };
}

const TEAMS: Team[] = [
  { id: "team-eng", name: "Engineering", managerId: "manager-1", managerName: "Manager One" },
  { id: "team-design", name: "Design", managerId: null, managerName: null },
];

describe("isHr", () => {
  it("is true only for the hr role", () => {
    expect(isHr("hr")).toBe(true);
    expect(isHr("manager")).toBe(false);
    expect(isHr("employee")).toBe(false);
  });
});

describe("isManagerOf", () => {
  it("is true when the viewer is the target's team's manager", () => {
    const viewer = person({ id: "manager-1", appRole: "manager" });
    const target = person({ id: "report-1", teamId: "team-eng" });
    expect(isManagerOf(viewer, target, TEAMS)).toBe(true);
  });

  it("is false for a different team's manager", () => {
    const viewer = person({ id: "manager-1", appRole: "manager" });
    const target = person({ id: "report-1", teamId: "team-design" });
    expect(isManagerOf(viewer, target, TEAMS)).toBe(false);
  });

  it("is false when the target's team has no manager assigned", () => {
    const viewer = person({ id: "manager-1", appRole: "manager" });
    const target = person({ id: "report-1", teamId: "team-design" });
    expect(isManagerOf(viewer, target, TEAMS)).toBe(false);
  });

  it("is false when the target has no team", () => {
    const viewer = person({ id: "manager-1", appRole: "manager" });
    const target = person({ id: "report-1", teamId: null });
    expect(isManagerOf(viewer, target, TEAMS)).toBe(false);
  });
});

describe("canSee", () => {
  it("lets anyone see themselves", () => {
    const p = person({ id: "self-1", teamId: "team-design" });
    expect(canSee(p, p, TEAMS)).toBe(true);
  });

  it("lets hr see anyone regardless of team", () => {
    const hr = person({ id: "hr-1", appRole: "hr", teamId: "team-design" });
    const target = person({ id: "other-1", teamId: "team-eng" });
    expect(canSee(hr, target, TEAMS)).toBe(true);
  });

  it("lets a manager see their team", () => {
    const manager = person({ id: "manager-1", appRole: "manager", teamId: "team-eng" });
    const report = person({ id: "report-1", teamId: "team-eng" });
    expect(canSee(manager, report, TEAMS)).toBe(true);
  });

  it("blocks a manager from a different team", () => {
    const manager = person({ id: "manager-1", appRole: "manager", teamId: "team-eng" });
    const other = person({ id: "other-1", teamId: "team-design" });
    expect(canSee(manager, other, TEAMS)).toBe(false);
  });

  it("blocks a plain employee from seeing a teammate", () => {
    const employee = person({ id: "emp-1", teamId: "team-eng" });
    const teammate = person({ id: "emp-2", teamId: "team-eng" });
    expect(canSee(employee, teammate, TEAMS)).toBe(false);
  });
});

describe("scopeLabel", () => {
  it("describes each role's scope", () => {
    expect(scopeLabel("employee")).toBe("Just you");
    expect(scopeLabel("manager")).toBe("Your team");
    expect(scopeLabel("hr")).toBe("Organization-wide");
  });
});

describe("visibleTo", () => {
  it("filters a list of arbitrary records through canSee via a mapper", () => {
    const manager = person({ id: "manager-1", appRole: "manager", teamId: "team-eng" });
    const records = [
      { id: "a", person: person({ id: "a", teamId: "team-eng" }) },
      { id: "b", person: person({ id: "b", teamId: "team-design" }) },
      { id: "c", person: person({ id: "c", teamId: "team-eng" }) },
    ];
    const visible = visibleTo(manager, records, (r) => r.person, TEAMS);
    expect(visible.map((r) => r.id)).toEqual(["a", "c"]);
  });
});
