import type { IconName } from "@/components/icons/Icon";
import type { AppRole } from "@/types/person";

/**
 * The rail+panel nav model: tier 1 is a section on the icon rail
 * (NavRail.tsx), tier 2 is that section's items in the contextual panel
 * (NavPanel.tsx); MobileTabBar.tsx reads the same data for the
 * bottom-tab-bar/top-utility-strip equivalent below md. Replaced the flat
 * components/shell/navItems.ts + Sidebar.tsx pair phase 04 deleted.
 */

export type NavSectionKey = "home" | "people" | "wellbeing" | "productivity" | "org";

export interface RailItemDef {
  href: string;
  label: string;
  icon: IconName;
  /** Roles allowed to see this item. Omit for "everyone" — nav tidiness only:
   *  RLS and each route's own role check are the actual access control. */
  roles?: AppRole[];
  /** Highlight this item only on an exact pathname match. `/tasks` needs it
   *  because `/tasks/workload` and `/tasks/project/…` sit underneath it but
   *  are their own panel destinations — without this, "My Tasks" reads active
   *  on all three. */
  exact?: boolean;
}

export interface NavSectionDef {
  key: NavSectionKey;
  label: string;
  /** The rail's own icon for this section — distinct from any one item's
   *  icon inside it, since the rail shows one icon per section, not per
   *  destination. */
  icon: IconName;
  items: RailItemDef[];
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    key: "home",
    label: "Home",
    icon: "grid",
    items: [{ href: "/dashboard", label: "Overview", icon: "grid" }],
  },
  {
    key: "people",
    label: "People",
    icon: "users",
    items: [
      { href: "/directory", label: "Directory", icon: "users" },
      { href: "/attendance", label: "Attendance", icon: "calendar" },
      { href: "/time-off", label: "Time Off", icon: "timer" },
      { href: "/one-on-ones", label: "1:1s", icon: "check" },
    ],
  },
  {
    key: "wellbeing",
    label: "Wellbeing",
    icon: "smile",
    items: [
      { href: "/burnout", label: "Burnout Risk", icon: "activity" },
      { href: "/nudges", label: "Nudges", icon: "bell" },
      { href: "/mood", label: "Mood", icon: "smile" },
      { href: "/pulse", label: "Pulse", icon: "activity" },
      { href: "/boundary", label: "Right to Disconnect", icon: "shield" },
      { href: "/kudos", label: "Kudos", icon: "coffee" },
      { href: "/focus", label: "Focus Mode", icon: "focus" },
    ],
  },
  {
    key: "productivity",
    label: "Productivity",
    icon: "list",
    items: [
      { href: "/tasks", label: "My Tasks", icon: "list", exact: true },
      { href: "/tasks/workload", label: "Employees Workload", icon: "activity" },
      { href: "/meetings", label: "Meeting load", icon: "calendar", roles: ["manager", "hr"] },
    ],
  },
  {
    key: "org",
    label: "Org",
    icon: "activity",
    items: [
      { href: "/insights", label: "Insights", icon: "activity", roles: ["hr"] },
      { href: "/teams", label: "Teams", icon: "users", roles: ["hr"] },
    ],
  },
];

/** Rail utility cluster — below the divider, not a tier-1 section: no
 *  scope switcher. Inbox and Settings were one lumped "utility" bucket
 *  until a person landing on /inbox found the panel listing Schedule/
 *  Appearance/Your data alongside it — Inbox is a single destination
 *  with nothing to sub-navigate, so it gets its own empty-subnav bucket
 *  instead of inheriting Settings' three items. */
export const INBOX_ITEMS: RailItemDef[] = [{ href: "/inbox", label: "Inbox", icon: "inbox" }];

export const SETTINGS_ITEMS: RailItemDef[] = [
  { href: "/settings/schedule", label: "Schedule", icon: "settings" },
  { href: "/settings/appearance", label: "Appearance", icon: "eye" },
  { href: "/transparency", label: "Your data", icon: "lock" },
];

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Resolves a pathname to the rail destination it belongs under — a
 *  NavSectionKey, "inbox", "settings", or null for a route this nav
 *  model doesn't know about yet. Prefix-matched, so /tasks/project/x/board
 *  resolves under the /tasks item the same as /tasks itself. */
export function sectionFor(pathname: string): NavSectionKey | "inbox" | "settings" | null {
  for (const section of NAV_SECTIONS) {
    if (section.items.some((item) => matches(pathname, item.href))) return section.key;
  }
  if (INBOX_ITEMS.some((item) => matches(pathname, item.href))) return "inbox";
  if (SETTINGS_ITEMS.some((item) => matches(pathname, item.href))) return "settings";
  return null;
}

/** Drops role-restricted items the viewer can't use, and any section left
 *  empty — mirrors navGroupsFor in navItems.ts. */
export function sectionsFor(role: AppRole): NavSectionDef[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
