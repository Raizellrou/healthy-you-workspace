import type { IconName } from "@/components/icons/Icon";

/**
 * Marketing taxonomy for the public landing page — deliberately separate
 * from PILLARS (lib/pillars.ts), which is the authoritative in-app product
 * list. This is a narrative overlay (5 letters spelling PETAL) mapped onto
 * a subset of real pillars, not a second product catalog. If the two ever
 * need to drift (e.g. a pillar renames but the marketing copy shouldn't
 * change mid-campaign), that's expected — don't try to derive one from the
 * other.
 *
 * Single source of truth for every place this acronym is rendered (hero
 * strip, feature breakdown, footer signature) — edit here, not per call site.
 *
 * Each letter sits on one stop of the brand spectrum (--p1..--p5, defined
 * in app/globals.css) — indigo at P through rose at L — rather than on the
 * per-route --pillar-* colors. The spectrum is the landing narrative
 * ("five petals, one bloom"); the pillar colors stay the product's.
 *
 * Class fields are full literal Tailwind class names (never
 * template-interpolated) so Tailwind's content scanner finds them as
 * static strings here. `anchorId` is the scroll target the hero legend
 * links to — plain `<a href="#...">`, so the jump needs no JavaScript and
 * stays keyboard-operable.
 */
export interface PetalLetter {
  letter: string;
  word: string;
  tagline: string;
  description: string;
  icon: IconName;
  href: string;
  anchorId: string;
  /** Text/icon-safe spectrum stop. */
  colorClass: string;
  /** Vivid decorative stop, for dots and glyph fills. */
  dotClass: string;
  softBgClass: string;
}

/**
 * Accent colour for each product pillar's card in the landing feature
 * grid, keyed by the pillar's route. Kept here rather than added to
 * lib/pillars.ts because it is a landing-page presentation choice — the
 * PILLARS array stays the product's own list, with no marketing styling
 * baked into it. Values are CSS custom-property names from
 * app/globals.css, fed to the card's `--accent`.
 *
 * This is the SAME five-pillar assignment PETAL_LETTERS uses below
 * (burnout→p1, nudges→p2, kudos→p3, focus→p4, boundary→p5) — the two must
 * agree, since a visitor sees both on the same page. The two pillars
 * PETAL_LETTERS doesn't cover (mood, tasks) reuse the stop of the pillar
 * they share a category with in lib/pillars.ts: mood joins nudges under
 * "Wellbeing", tasks joins focus under "Productivity". This same
 * five-stop-for-seven-pillar mapping is also what app/globals.css's
 * `--pillar-*` tokens alias to, so a pillar's color is identical whether
 * you're looking at the landing page or the signed-in product.
 *
 * A pillar with no entry falls back to --ink, so adding a pillar to
 * PILLARS never breaks this grid; it just renders neutral until given a
 * stop here.
 */
export const PILLAR_ACCENT: Record<string, string> = {
  "/burnout": "var(--p1)",
  "/nudges": "var(--p2)",
  "/mood": "var(--p2)",
  "/boundary": "var(--p5)",
  "/kudos": "var(--p3)",
  "/tasks": "var(--p4)",
  "/focus": "var(--p4)",
};

export const PETAL_LETTERS: PetalLetter[] = [
  {
    letter: "P",
    word: "Predictive Wellness",
    tagline: "Burnout risk scoring and early intervention",
    description:
      "A composite score blends workload, schedule strain, and check-in signals to flag who's trending toward burnout, early enough for a manager or HR to step in before it becomes a resignation.",
    icon: "activity",
    href: "/burnout",
    anchorId: "pillar-1",
    colorClass: "text-p1",
    dotClass: "bg-p1-soft",
    softBgClass: "bg-p1-soft/15",
  },
  {
    letter: "E",
    word: "Ergonomic Health",
    tagline: "Smart nudges for stretching, hydration, posture",
    description:
      "Quiet-hours-aware reminders land when someone's actually at their desk, not on a fixed timer, nudging a stretch, a glass of water, or a posture check without ever pinging after hours.",
    icon: "stretch",
    href: "/nudges",
    anchorId: "pillar-2",
    colorClass: "text-p2",
    dotClass: "bg-p2-soft",
    softBgClass: "bg-p2-soft/15",
  },
  {
    letter: "T",
    word: "Team Connection",
    tagline: "Peer recognition through buddy pairings and kudos",
    description:
      "A rotating buddy pairing makes sure recognition doesn't just flow to the loudest voices in the room. Everyone gets a rotating partner to send a quick, genuine thanks to.",
    icon: "coffee",
    href: "/kudos",
    anchorId: "pillar-3",
    colorClass: "text-p3",
    dotClass: "bg-p3-soft",
    softBgClass: "bg-p3-soft/15",
  },
  {
    letter: "A",
    word: "Adaptive Focus",
    tagline: "Workspace modes that adapt to your current load",
    description:
      "The workspace itself adjusts to how stretched someone currently is, trimming distractions and surfacing what matters most when the day is already too full.",
    icon: "focus",
    href: "/focus",
    anchorId: "pillar-4",
    colorClass: "text-p4",
    dotClass: "bg-p4-soft",
    softBgClass: "bg-p4-soft/15",
  },
  {
    letter: "L",
    word: "Life-Work Balance",
    tagline: "Right-to-disconnect enforcement and boundary messaging",
    description:
      "Messages sent outside someone's working hours are held and delivered when their day actually starts. It's a boundary the platform enforces automatically, not one people have to defend themselves.",
    icon: "shield",
    href: "/boundary",
    anchorId: "pillar-5",
    colorClass: "text-p5",
    dotClass: "bg-p5-soft",
    softBgClass: "bg-p5-soft/15",
  },
];
