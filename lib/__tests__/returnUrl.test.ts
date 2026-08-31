import { describe, expect, it } from "vitest";
import { getSafeReturnUrl } from "@/app/login/returnUrl";

describe("getSafeReturnUrl", () => {
  it("returns the target path when present and safe", () => {
    expect(getSafeReturnUrl("?returnUrl=%2Ftasks%2Fworkload")).toBe("/tasks/workload");
  });

  it("falls back to /dashboard when returnUrl is missing", () => {
    expect(getSafeReturnUrl("")).toBe("/dashboard");
  });

  it("rejects a scheme-relative URL (open redirect)", () => {
    expect(getSafeReturnUrl("?returnUrl=%2F%2Fevil.com")).toBe("/dashboard");
  });

  it("rejects an absolute URL with a host", () => {
    expect(getSafeReturnUrl("?returnUrl=https%3A%2F%2Fevil.com")).toBe("/dashboard");
  });

  it("rejects a path that isn't absolute", () => {
    expect(getSafeReturnUrl("?returnUrl=tasks")).toBe("/dashboard");
  });

  it("refuses to redirect back into /login", () => {
    expect(getSafeReturnUrl("?returnUrl=%2Flogin")).toBe("/dashboard");
    expect(getSafeReturnUrl("?returnUrl=%2Flogin%2Fsomething")).toBe("/dashboard");
  });
});
