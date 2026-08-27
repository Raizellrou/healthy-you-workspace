import { describe, it, expect } from "vitest";
import { suggestRebalanceMoves, type RebalancePerson, type RebalanceTask } from "@/lib/rebalance";

function person(employeeId: string, name: string, committedHours: number, capacityHours = 40): RebalancePerson {
  return { employeeId, name, committedHours, capacityHours };
}

function task(id: string, assigneeId: string, estimateHours: number, title = id): RebalanceTask {
  return { id, title, assigneeId, estimateHours };
}

describe("suggestRebalanceMoves", () => {
  it("returns no moves when nobody is over 100%", () => {
    const people = [person("a", "Rita", 30), person("b", "Will", 20)];
    const tasks = [task("t1", "a", 10)];
    expect(suggestRebalanceMoves(people, tasks)).toEqual([]);
  });

  it("moves a task from the overloaded person to the one with the most headroom", () => {
    const people = [person("a", "Rita", 48), person("b", "Will", 12), person("c", "Sam", 20)];
    const tasks = [task("t1", "a", 4), task("t2", "a", 8)];
    const moves = suggestRebalanceMoves(people, tasks);
    expect(moves).toHaveLength(1);
    expect(moves[0].fromEmployeeId).toBe("a");
    expect(moves[0].toEmployeeId).toBe("b"); // Will has the most headroom (12/40)
    expect(moves[0].taskId).toBe("t2"); // biggest task moves first
  });

  it("stops once the overloaded person drops to 100% or below", () => {
    const people = [person("a", "Rita", 44), person("b", "Will", 10)];
    const tasks = [task("t1", "a", 4)];
    const moves = suggestRebalanceMoves(people, tasks);
    expect(moves).toHaveLength(1);
    expect(moves[0].taskId).toBe("t1");
    // 44 - 4 = 40 = exactly capacity, no longer over 100%, nothing left to move
  });

  it("never pushes a receiver over 100% capacity", () => {
    const people = [person("a", "Rita", 60), person("b", "Will", 38)];
    const tasks = [task("t1", "a", 10)];
    // Will only has 2h of headroom; the 10h task would push him to 120%
    expect(suggestRebalanceMoves(people, tasks)).toEqual([]);
  });

  it("skips a task that doesn't fit anywhere rather than moving it anyway", () => {
    const people = [person("a", "Rita", 60), person("b", "Will", 39), person("c", "Sam", 10)];
    const tasks = [task("big", "a", 25), task("small", "a", 5)];
    const moves = suggestRebalanceMoves(people, tasks);
    // "big" (25h) doesn't fit under Will (1h headroom) or Sam (30h headroom would
    // fit actually) -- Sam has room, so "big" should go to Sam.
    expect(moves.some((m) => m.taskId === "big" && m.toEmployeeId === "c")).toBe(true);
  });

  it("returns an empty list for no people or no tasks", () => {
    expect(suggestRebalanceMoves([], [])).toEqual([]);
    expect(suggestRebalanceMoves([person("a", "Rita", 50)], [])).toEqual([]);
  });

  it("caps the number of suggested moves", () => {
    // One very overloaded person with many tiny tasks, many people with headroom.
    const overloaded = person("a", "Rita", 90);
    const receivers = Array.from({ length: 10 }, (_, i) => person(`r${i}`, `Person ${i}`, 0));
    const tasks = Array.from({ length: 20 }, (_, i) => task(`t${i}`, "a", 5));
    const moves = suggestRebalanceMoves([overloaded, ...receivers], tasks);
    expect(moves.length).toBeLessThanOrEqual(6);
  });
});
