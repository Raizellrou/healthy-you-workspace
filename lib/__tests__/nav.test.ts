import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sectionFor } from "@/components/shell/navSections";

/** Every actually-visitable top-level route under app/(app) — walked from
 *  disk rather than hardcoded, so this test fails the moment a new
 *  pillar/page is added without a nav home, instead of silently going
 *  stale like the hardcoded lists this refactor kept finding. Requires a
 *  page.tsx directly in the segment, so a pure container folder like
 *  settings/ (real pages only at settings/schedule, settings/appearance)
 *  isn't treated as a route of its own — Next.js wouldn't render it either. */
function routeSegments(): string[] {
  const appDir = join(__dirname, "..", "..", "app", "(app)");
  return readdirSync(appDir).filter(
    (name) =>
      statSync(join(appDir, name)).isDirectory() && existsSync(join(appDir, name, "page.tsx"))
  );
}

describe("sectionFor", () => {
  it("resolves every app/(app) route to exactly one rail destination", () => {
    for (const segment of routeSegments()) {
      const result = sectionFor(`/${segment}`);
      expect(result, `/${segment} has no rail section or utility slot`).not.toBeNull();
    }
  });

  it("prefix-matches nested routes under their parent item", () => {
    expect(sectionFor("/tasks/project/abc/board")).toBe("productivity");
    expect(sectionFor("/tasks/workload")).toBe("productivity");
    expect(sectionFor("/settings/appearance")).toBe("settings");
  });

  it("resolves project routes under Productivity", () => {
    expect(sectionFor("/tasks/project/abc/list")).toBe("productivity");
    expect(sectionFor("/tasks/workload")).toBe("productivity");
  });

  it("keeps inbox and settings as separate panels", () => {
    expect(sectionFor("/inbox")).toBe("inbox");
    expect(sectionFor("/settings/schedule")).toBe("settings");
    expect(sectionFor("/transparency")).toBe("settings");
  });

  it("does not partial-match unrelated segments sharing a prefix", () => {
    expect(sectionFor("/task-templates")).toBeNull();
  });

  it("returns null for an unknown route", () => {
    expect(sectionFor("/does-not-exist")).toBeNull();
  });
});
