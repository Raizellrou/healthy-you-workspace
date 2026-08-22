"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Dropdown menu for row-level actions (delete task, change view, reassign).
 *
 * Deliberately small: closes on outside click, on Escape, and after a
 * selection. Anything that needs full roving-focus semantics should be a
 * `<Modal>` or a `<Select>` instead — both of those get it from the platform.
 */
export function Menu({
  trigger,
  items,
  align = "right",
  placement = "bottom",
  ariaLabel,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  /** "top" opens the dropdown above the trigger instead of below — for a
   *  trigger anchored near the bottom of its scroll container (like the
   *  sidebar's account menu), where "below" has nowhere to render and gets
   *  clipped by the container's own overflow instead of just showing over
   *  content, which a browser would otherwise silently reposition for you. */
  placement?: "top" | "bottom";
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-20 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "top" ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:text-ink-mute ${
                item.danger
                  ? "text-risk-critical hover:bg-risk-critical/10"
                  : "text-ink-soft hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
