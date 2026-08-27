import { describe, it, expect, vi } from "vitest";
import { describeDbError } from "@/lib/action-result";

describe("describeDbError", () => {
  it("maps known Postgres codes to readable messages", () => {
    expect(describeDbError({ code: "23505", message: "duplicate key" })).toBe("That already exists.");
    expect(describeDbError({ code: "23514", message: "check constraint" })).toBe("That value isn't allowed.");
    expect(describeDbError({ code: "23503", message: "fk violation" })).toBe("A related record is missing.");
    expect(describeDbError({ code: "42501", message: "rls denied" })).toBe("You don't have access to do that.");
  });

  it("prefers a caller-supplied override for a known code", () => {
    expect(describeDbError({ code: "23505", message: "duplicate key" }, { "23505": "Already answered this week." })).toBe(
      "Already answered this week."
    );
  });

  it("never leaks the raw Postgres message for an unrecognized code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = describeDbError({ code: "55P03", message: "column users.ssn does not exist, constraint fk_secret" });
    expect(result).not.toContain("ssn");
    expect(result).not.toContain("fk_secret");
    expect(result).toBe("Something went wrong. Please try again.");
    spy.mockRestore();
  });
});
