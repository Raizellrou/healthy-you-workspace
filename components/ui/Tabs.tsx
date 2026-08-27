"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** When set the tab renders as a link. Otherwise it's a button and `onSelect` fires. */
  href?: string;
  count?: number;
}

/**
 * Segmented tab bar. Handles both flavours the app needs: route tabs (the
 * project/view switcher, where the URL is the state) and local tabs (inbox
 * filters). Route tabs pass `href`; local tabs pass `onSelect`.
 */
export function Tabs({
  items,
  active,
  onSelect,
  ariaLabel,
  className = "",
}: {
  items: TabItem[];
  active: string;
  onSelect?: (key: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1 ${className}`}
    >
      {items.map((item) => {
        const selected = item.key === active;
        const classes = `inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
          selected
            ? "bg-surface text-ink shadow-sm"
            : "text-ink-soft hover:text-ink"
        }`;

        const inner = (
          <>
            {item.label}
            {item.count !== undefined && (
              <span
                className={`text-xs tabular-nums ${selected ? "text-ink-mute" : "text-ink-mute"}`}
              >
                {item.count}
              </span>
            )}
          </>
        );

        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            role="tab"
            aria-selected={selected}
            className={classes}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect?.(item.key)}
            className={classes}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
