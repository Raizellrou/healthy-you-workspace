import type { ReactNode } from "react";

/** The small uppercase header above a card/section — copy-pasted with
 *  minor drift (font-semibold vs font-bold, text-xs vs the sub-12px
 *  text-[11px]) across dashboard, attendance, mood, burnout, and 1:1s.
 *  One definition, one floor (text-xs, the 12px minimum). */
export function SectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-xs font-semibold uppercase tracking-wide text-ink-mute ${className}`}>
      {children}
    </div>
  );
}
