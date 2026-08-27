import { describe, it, expect } from "vitest";
import { truncateForConfirm } from "@/lib/format";

describe("truncateForConfirm", () => {
  it("returns short text unchanged", () => {
    expect(truncateForConfirm("Fix login bug")).toBe("Fix login bug");
  });

  it("truncates text past the limit and appends an ellipsis", () => {
    const long = "x".repeat(100);
    const result = truncateForConfirm(long);
    expect(result).toHaveLength(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects a custom maxLength", () => {
    expect(truncateForConfirm("abcdefghij", 5)).toBe("abcd…");
  });

  it("does not truncate text exactly at the limit", () => {
    const exact = "x".repeat(80);
    expect(truncateForConfirm(exact)).toBe(exact);
  });
});
