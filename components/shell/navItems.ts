import type { IconName } from "@/components/icons/Icon";
import type { AppRole } from "@/types/person";

export interface NavItemDef {
  href: string;
  label: string;
  icon: IconName;
  accent?: string;
  /** Roles allowed to see this item. Omit for "everyone". This is nav
   *  tidiness, not access control — every gated route checks its own role
   *  and RLS enforces the data either way. */
  roles?: AppRole[];
}

export interface NavGroup {
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "grid" },
      { href: "/inbox", label: "Inbox", icon: "inbox" },
      { href: "/insights", label: "Insights", icon: "activity", roles: ["hr"] },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/directory", label: "Directory", icon: "users" },
      { href: "/attendance", label: "Attendance", icon: "calendar" },
      { href: "/time-off", label: "Time Off", icon: "timer" },
      // Deliberately unrestricted. A manager sees their team's agendas here;
      // everyone else sees the 1:1 records written about them. Hiding the
      // link from employees would mean that dismissing the scheduling
      // notification made the record unreachable — the exact hidden-file
      // outcome 0021_one_on_ones.sql is written to prevent.
      { href: "/one-on-ones", label: "1:1s", icon: "check" },
      { href: "/meetings", label: "Meeting load", icon: "calendar", roles: ["manager", "hr"] },
      { href: "/teams", label: "Teams", icon: "users", roles: ["hr"] },
    ],
  },
  {
    label: "Six Pillars",
    items: [
      { href: "/burnout", label: "Predict", icon: "activity", accent: "#6F49A6" },
      { href: "/nudges", label: "Energize", icon: "bell", accent: "#C7A2E5" },
      { href: "/mood", label: "Tune In", icon: "smile", accent: "#FFB5C5" },
      { href: "/pulse", label: "Pulse", icon: "activity", accent: "#FFB5C5" },
      { href: "/boundary", label: "Anchor", icon: "shield", accent: "#A8D592" },
      { href: "/kudos", label: "Link", icon: "coffee", accent: "#87D380" },
      { href: "/focus", label: "Adapt", icon: "focus", accent: "#87CEEB" },
    ],
  },
  {
    label: "Productivity",
    items: [{ href: "/tasks", label: "Tasks", icon: "list" }],
  },
  {
    label: "Account",
    items: [
      { href: "/settings/schedule", label: "Schedule", icon: "settings" },
      { href: "/settings/appearance", label: "Appearance", icon: "eye" },
      { href: "/transparency", label: "Your data", icon: "lock" },
    ],
  },
];

// Flat list retained for callers that just need "every route" (e.g. active-tab
// checks) without the grouping/accent metadata.
export const NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items);

/** Drops role-restricted items the viewer can't use, and any group left empty. */
export function navGroupsFor(role: AppRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
