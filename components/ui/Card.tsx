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
    <As
      className={`rounded-xl border border-line bg-surface p-5 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </As>
  );
}
