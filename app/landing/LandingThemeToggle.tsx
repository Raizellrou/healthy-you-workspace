"use client";

import { useTheme } from "@/lib/use-theme";

/**
 * Circular sun/moon toggle for the landing nav. Shares all of its state
 * logic with the in-app control via useTheme() — only the presentation
 * differs (this one is an icon button; components/shell/ThemeToggle.tsx is
 * a labelled row in the account menu).
 *
 * Both icons render at once and cross-fade via opacity/transform so the
 * swap animates; the inactive one is inert to assistive tech because the
 * button carries its own aria-label and the SVGs are aria-hidden.
 */
export function LandingThemeToggle() {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel transition-transform duration-300 hover:-rotate-12"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
        className={`absolute h-[17px] w-[17px] text-gold transition-all duration-300 ${
          isDark ? "scale-50 rotate-45 opacity-0" : "scale-100 rotate-0 opacity-100"
        }`}
      >
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={`absolute h-[17px] w-[17px] text-p3 transition-all duration-300 ${
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-45 opacity-0"
        }`}
      >
        <path d="M20 14.8A8.5 8.5 0 119.2 4a7 7 0 0010.8 10.8Z" />
      </svg>
    </button>
  );
}
