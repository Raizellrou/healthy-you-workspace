"use client";

import { useTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:bg-surface-2"
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="10" cy="10" r="4.5" />
          <path d="M10 1.5v2M10 16.5v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1.5 10h2M16.5 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M17 11.5A7.5 7.5 0 018.5 3 7.5 7.5 0 1017 11.5z" strokeLinejoin="round" />
        </svg>
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
