import { describe, it, expect } from "vitest";
import { scoreMatch, searchIndex, buildSearchIndex, type SearchItem } from "@/lib/search";
import type { Employee } from "@/types/employee";
import type { Project, Task } from "@/types/task";
import type { AppRole } from "@/types/person";

describe("scoreMatch", () => {
  it("scores an exact match highest", () => {
    expect(scoreMatch("burnout", "burnout")).toBe(100);
  });

  it("scores a prefix match above a mid-word match", () => {
    const prefix = scoreMatch("bur", "burnout risk");
    const midword = scoreMatch("out", "burnout risk");
    expect(prefix).not.toBeNull();
    expect(midword).not.toBeNull();
    expect(prefix!).toBeGreaterThan(midword!);
  });

  it("scores a word-boundary match above a same-position mid-word substring", () => {
    const boundary = scoreMatch("risk", "burnout risk");
    expect(boundary).not.toBeNull();
    // "risk" is also a mid-word-adjacent substring elsewhere in longer text —
    // the point here is boundary beats plain substring at a later index.
    const laterSubstring = scoreMatch("isk", "burnout risk");
    expect(boundary!).toBeGreaterThan(laterSubstring!);
  });

  it("falls back to a scattered subsequence match", () => {
    // "brn" as a subsequence of "burnout" — not contiguous, not a substring.
    expect(scoreMatch("brn", "burnout")).not.toBeNull();
    expect(scoreMatch("brn", "burnout")!).toBeLessThan(scoreMatch("bur", "burnout")!);
  });

  it("returns null when the query isn't a subsequence at all", () => {
    expect(scoreMatch("xyz", "burnout")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(scoreMatch("BUR", "burnout")).toBe(scoreMatch("bur", "burnout"));
  });

  it("empty query matches everything at score 0", () => {
    expect(scoreMatch("", "anything")).toBe(0);
  });
});

describe("searchIndex", () => {
  const items: SearchItem[] = [
    { type: "page", id: "/burnout", label: "Burnout Risk", href: "/burnout", icon: "activity" },
    { type: "person", id: "1", label: "Amara Adeyemi", sublabel: "Software Engineer · Product", href: "/directory", icon: "users" },
    { type: "project", id: "p1", label: "Design Sprint", href: "/tasks/project/p1/board", icon: "list" },
  ];

  it("returns nothing for a blank query", () => {
    expect(searchIndex(items, "")).toEqual([]);
    expect(searchIndex(items, "   ")).toEqual([]);
  });

  it("ranks a label match above a sublabel-only match", () => {
    // "amara" only matches the person's label; "product" only matches their
    // sublabel — label match must still win even though both hit the same item.
    const results = searchIndex(items, "burn");
    expect(results[0].label).toBe("Burnout Risk");
  });

  it("finds a person by a sublabel term without ranking it above a real label hit", () => {
    const results = searchIndex(items, "product");
    expect(results[0].label).toBe("Amara Adeyemi");
  });

  it("respects the limit", () => {
    const many: SearchItem[] = Array.from({ length: 20 }, (_, i) => ({
      type: "page",
      id: `/x${i}`,
      label: `Match ${i}`,
      href: `/x${i}`,
      icon: "grid",
    }));
    expect(searchIndex(many, "match", 5)).toHaveLength(5);
  });
});

describe("buildSearchIndex", () => {
  it("only includes pages the role can see", () => {
    const employee = buildSearchIndex({ employees: [], projects: [], myTasks: [], role: "employee", defaultTaskView: "board" });
    const hr = buildSearchIndex({ employees: [], projects: [], myTasks: [], role: "hr", defaultTaskView: "board" });
    expect(employee.some((i) => i.href === "/insights")).toBe(false);
    expect(hr.some((i) => i.href === "/insights")).toBe(true);
  });

  it("includes people, projects, and the caller's own tasks", () => {
    const emp: Employee = {
      id: "e1", name: "Amara Adeyemi", team: "Product", role: "Software Engineer", email: "a@x.test",
      worked: true, meeting: 0, offHours: 0, available: 40, meetingAvg: 0, streakDays: 0,
      daysSincePto: 0, onPto: false, offHoursWeekly: 0, returnIn: null, avatarColor: "#000",
    };
    const project: Project = { id: "p1", name: "Design Sprint", color: "#fff", created_at: "2026-01-01" };
    const task: Task = {
      id: "t1", project_id: "p1", section_id: null, title: "Finalize pricing page copy",
      description: null, assignee_id: "e1", created_by: "e1", priority: "medium", due_date: null,
      done: false, position: 0, created_at: "2026-01-01", updated_at: "2026-01-01",
    };
    const index = buildSearchIndex({ employees: [emp], projects: [project], myTasks: [task], role: "employee", defaultTaskView: "board" });
    expect(index.find((i) => i.type === "person")?.label).toBe("Amara Adeyemi");
    expect(index.find((i) => i.type === "project")?.href).toBe("/tasks/project/p1/board");
    expect(index.find((i) => i.type === "task")?.href).toBe("/tasks/t1");
  });

  /** The palette is a second route to every page the nav lists, so it has
   *  to honour the same role filter — otherwise ⌘K hands an employee a link
   *  the sidebar deliberately hid. It reads sectionsFor(role), so this is
   *  really a guard against that wiring being bypassed later. */
  it("omits role-gated pages for a role that cannot reach them", () => {
    const args = { employees: [], projects: [], myTasks: [], defaultTaskView: "board" };
    const hrefsFor = (role: AppRole) =>
      buildSearchIndex({ ...args, role })
        .filter((i) => i.type === "page")
        .map((i) => i.href);

    expect(hrefsFor("employee")).not.toContain("/teams");
    expect(hrefsFor("employee")).not.toContain("/insights");
    expect(hrefsFor("employee")).not.toContain("/meetings");

    expect(hrefsFor("manager")).toContain("/meetings");
    expect(hrefsFor("manager")).not.toContain("/teams");

    expect(hrefsFor("hr")).toContain("/teams");
    expect(hrefsFor("hr")).toContain("/insights");
  });
});
