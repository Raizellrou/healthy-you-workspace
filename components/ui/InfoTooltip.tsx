"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";

/** Click-to-toggle rather than hover-only: hover never fires on touch, and
 *  a button is keyboard-reachable (Tab + Enter/Space) where a hover-only
 *  target isn't. Closes on outside click or Escape like any other popover
 *  in this app (see components/ui/Menu.tsx, components/ui/Modal.tsx).
 *
 *  `iconOnly` swaps the labelled pill (sized for a page-header action slot)
 *  for a bare (i) glyph sized to sit inline next to a card's own heading —
 *  used where a page has several dense secondary explanations and repeating
 *  the full pill next to each one would be its own source of clutter. */
export function InfoTooltip({
  label = "About this data",
  iconOnly = false,
  align = "left",
  children,
}: {
  label?: string;
  iconOnly?: boolean;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className={
          iconOnly
            ? "inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-mute transition-colors hover:text-ink"
            : "inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg shadow-sm transition-colors hover:bg-brand-dark"
        }
      >
        <Icon name="info" size={iconOnly ? 14 : 14} />
        {iconOnly ? null : label}
      </button>

      {open ? (
        <div
          role="tooltip"
          className={`animate-toast-in absolute top-full z-20 mt-2 w-72 rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-soft shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
