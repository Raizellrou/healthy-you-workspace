import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: As = "div",
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  style?: CSSProperties;
}) {
  return (
    // Padding comes from the `card-surface` class (app/globals.css), which
    // reads --card-pad, rather than a fixed `p-5` utility — that's what
    // lets ui_preferences.density retune every card at once. It is a class
    // and not an inline style on purpose: `<Card className="p-0">` is used
    // for full-bleed content (attendance, dashboard), and an inline style
    // would silently beat that utility and break both.
    <As
      className={`card-surface rounded-xl border border-line bg-surface shadow-sm ${className}`}
      style={style}
    >
      {children}
    </As>
  );
}
