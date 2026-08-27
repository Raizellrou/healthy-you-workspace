"use client";

import type { ReactNode } from "react";

/**
 * Floating bulk-action bar for multi-selected rows. A native checkbox
 * drives selection (components/tasks/TaskRow.tsx) — deliberately not the
 * round done-toggle button, which already means something else on the
 * same row.
 *
 * `actions` is a slot rather than fixed buttons so this stays a generic
 * primitive — the domain-specific pieces (an AssigneePicker, for instance)
 * belong to whatever feature composes this, not to components/ui/.
 */
export function SelectionBar({
  count,
  actions,
  onClear,
  pending,
  error,
}: {
  count: number;
  actions: ReactNode;
  onClear: () => void;
  pending: boolean;
  error: string | null;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:bottom-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium text-ink">
            {count} selected
          </span>
          <div className="h-4 w-px bg-line" aria-hidden="true" />
          {actions}
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            aria-label="Clear selection"
            className="rounded-lg p-1.5 text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-surface px-3 py-1.5 text-xs text-risk-critical shadow-lg">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
