import { describe, it, expect } from "vitest";
import { interventionFor } from "@/lib/interventions";

describe("interventionFor", () => {
  it("maps streak and pto to an immediate schedule_pto action", () => {
    expect(interventionFor("streak")).toMatchObject({ actionType: "schedule_pto", immediate: true });
    expect(interventionFor("pto")).toMatchObject({ actionType: "schedule_pto", immediate: true });
  });

  it("maps offHours and recovery to a non-immediate strict_quiet_hours action", () => {
    expect(interventionFor("offHours")).toMatchObject({ actionType: "strict_quiet_hours", immediate: false });
    expect(interventionFor("recovery")).toMatchObject({ actionType: "strict_quiet_hours", immediate: false });
  });

  it("maps taskLoad to rebalance_tasks and overdue to resolve_overdue", () => {
    expect(interventionFor("taskLoad").actionType).toBe("rebalance_tasks");
    expect(interventionFor("overdue").actionType).toBe("resolve_overdue");
  });

  it("maps meeting to reduce_meetings", () => {
    expect(interventionFor("meeting").actionType).toBe("reduce_meetings");
  });

  it("falls back to a general checkin for an unrecognized key rather than throwing", () => {
    expect(interventionFor("something_unexpected")).toMatchObject({ actionType: "general_checkin", immediate: false });
  });

  it("every spec has a non-empty label and description", () => {
    for (const key of ["streak", "meeting", "offHours", "pto", "taskLoad", "overdue", "recovery"]) {
      const spec = interventionFor(key);
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });
});
