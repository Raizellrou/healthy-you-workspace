import type { IconName } from "@/components/icons/Icon";

export interface NavItemDef {
  href: string;
  label: string;
  icon: IconName;
  accent?: string;
  /** Hidden from the nav unless the signed-in person's app_role is "hr". */
  hrOnly?: boolean;
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
      { href: "/insights", label: "Insights", icon: "activity", hrOnly: true },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/directory", label: "Directory", icon: "users" },
      { href: "/attendance", label: "Attendance", icon: "calendar" },
      { href: "/time-off", label: "Time Off", icon: "timer" },
      { href: "/teams", label: "Teams", icon: "users", hrOnly: true },
    ],
  },
  {
    label: "Six Pillars",
    items: [
      { href: "/burnout", label: "Predict", icon: "activity", accent: "#6F49A6" },
      { href: "/nudges", label: "Energize", icon: "bell", accent: "#C7A2E5" },
      { href: "/mood", label: "Tune In", icon: "smile", accent: "#FFB5C5" },
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
    ],
  },
];

// Flat list retained for callers that just need "every route" (e.g. active-tab
// checks) without the grouping/accent metadata.
export const NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items);

/** Drops hrOnly items when the viewer isn't HR, and any group left empty. */
export function navGroupsFor(isHr: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.hrOnly || isHr),
  })).filter((group) => group.items.length > 0);
}
