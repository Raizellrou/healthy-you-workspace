import type { IconName } from "@/components/icons/Icon";

export interface NavItemDef {
  href: string;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItemDef[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/directory", label: "Directory", icon: "users" },
  { href: "/attendance", label: "Attendance", icon: "calendar" },
  { href: "/burnout", label: "Burnout", icon: "activity" },
  { href: "/nudges", label: "Nudges", icon: "bell" },
  { href: "/mood", label: "Mood", icon: "smile" },
  { href: "/boundary", label: "Boundary", icon: "shield" },
  { href: "/kudos", label: "Kudos", icon: "coffee" },
  { href: "/focus", label: "Focus", icon: "focus" },
];
