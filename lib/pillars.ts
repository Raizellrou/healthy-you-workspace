import type { IconName } from "@/components/icons/Icon";

export interface Pillar {
  href: string;
  icon: IconName;
  category: string;
  label: string;
  description: string;
}

export const PILLARS: Pillar[] = [
  {
    href: "/burnout",
    icon: "activity",
    category: "Analytics",
    label: "Burnout Risk",
    description: "A composite score that flags who's trending toward burnout.",
  },
  {
    href: "/nudges",
    icon: "bell",
    category: "Wellbeing",
    label: "Nudges",
    description: "Gentle, quiet-hours-aware reminders to stretch, hydrate, and rest.",
  },
  {
    href: "/mood",
    icon: "smile",
    category: "Wellbeing",
    label: "Track the Mood",
    description: "A quick daily check-in, aggregated privately by team.",
  },
  {
    href: "/boundary",
    icon: "shield",
    category: "Wellbeing",
    label: "Right to Disconnect",
    description: "Schedule messages to land inside someone's working hours.",
  },
  {
    href: "/kudos",
    icon: "coffee",
    category: "Culture",
    label: "Give Me a Coffee",
    description: "Send a peer a quick note of thanks through a rotating buddy pairing.",
  },
  {
    href: "/focus",
    icon: "focus",
    category: "Productivity",
    label: "Focus Mode",
    description: "Adapts the workspace layout to how stretched someone currently is.",
  },
];
