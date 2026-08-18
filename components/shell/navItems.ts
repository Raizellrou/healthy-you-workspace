import type { IconName } from "@/components/icons/Icon";

export interface NavItemDef {
  href: string;
  label: string;
  icon: IconName;
  accent?: string;
}

export interface NavGroup {
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "grid" }],
  },
  {
    label: "People",
    items: [
      { href: "/directory", label: "Directory", icon: "users" },
      { href: "/attendance", label: "Attendance", icon: "calendar" },
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
];

// Flat list retained for callers that just need "every route" (e.g. active-tab
// checks) without the grouping/accent metadata.
export const NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items);
