import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sectionFor, sectionsFor } from "@/components/shell/navSections";
import type { AppRole } from "@/types/person";

/** Every actually-visitable top-level route under app/(app) — walked from
 *  disk rather than hardcoded, so this test fails the moment a new
 *  pillar/page is added without a nav home, instead of silently going
 *  stale like the hardcoded lists this refactor kept finding. Requires a
 *  page.tsx directly in the segment, so a pure container folder with no
 *  page.tsx of its own isn't treated as a route — Next.js wouldn't render
 *  it either. settings/ does have one (M17's redirect to
 *  settings/schedule), which is why sectionFor special-cases bare
 *  "/settings" rather than this walk excluding it. */
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

/**
 * The nav is the first of four layers keeping a role-gated screen away from
 * someone who shouldn't have it — the others being the page's own
 * notFound() (app/(app)/teams, /insights, /meetings), the Server Actions,
 * and RLS, which is the only one that actually enforces anything. This
 * layer is the one a regression would be quietest in: a missing `roles` on
 * a new item shows an employee a link that 404s, with nothing failing.
 */
describe("sectionsFor role filtering", () => {
  const hrefsFor = (role: AppRole) => sectionsFor(role).flatMap((s) => s.items.map((i) => i.href));

  const HR_ONLY = ["/insights", "/teams"];
  const MANAGER_OR_HR = ["/meetings"];

  it("hides HR-only destinations from an employee", () => {
    const hrefs = hrefsFor("employee");
    for (const href of [...HR_ONLY, ...MANAGER_OR_HR]) expect(hrefs).not.toContain(href);
  });

  it("hides HR-only destinations from a manager, but not the manager ones", () => {
    const hrefs = hrefsFor("manager");
    for (const href of HR_ONLY) expect(hrefs).not.toContain(href);
    for (const href of MANAGER_OR_HR) expect(hrefs).toContain(href);
  });

  it("shows every gated destination to HR", () => {
    const hrefs = hrefsFor("hr");
    for (const href of [...HR_ONLY, ...MANAGER_OR_HR]) expect(hrefs).toContain(href);
  });

  it("gives every role the ungated pillars", () => {
    for (const role of ["employee", "manager", "hr"] as AppRole[]) {
      const hrefs = hrefsFor(role);
      for (const href of ["/dashboard", "/mood", "/boundary", "/kudos", "/focus", "/tasks"]) {
        expect(hrefs).toContain(href);
      }
    }
  });
});
