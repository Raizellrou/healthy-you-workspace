import type { ReactNode } from "react";

/** The small mono, letter-spaced kicker above a heading, with its leading
 *  hairline. Shared brand chrome for the landing page and login screen —
 *  the app's own functional screens (dashboard, tasks, etc.) don't use
 *  this; it's specific to the marketing/auth "front door" surfaces. One
 *  component so the rule, tracking, and color are defined once rather than
 *  re-typed at every call site. */
export function Eyebrow({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-mute ${
        centered ? "justify-center" : ""
      }`}
    >
      <span className="h-px w-3.5 bg-ink-mute" aria-hidden="true" />
      {children}
    </span>
  );
}
