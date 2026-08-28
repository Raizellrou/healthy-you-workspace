"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark state, shared by every control that can flip the theme
 * (components/shell/ThemeToggle.tsx in the app chrome,
 * app/landing/LandingThemeToggle.tsx on the public page).
 *
 * The stored value and the `data-theme` attribute are the contract that
 * app/layout.tsx's THEME_INIT_SCRIPT reads before first paint to avoid a
 * flash of the wrong theme — so writing the attribute and localStorage
 * together, in that exact shape, is load-bearing. Extracted into a hook
 * rather than copied so a second toggle can't drift from the first.
 *
 * The initial read is deferred to an effect on purpose: localStorage and
 * matchMedia don't exist during SSR, so the server pass and the first
 * client render must agree on `false` before this corrects it.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(stored ? stored === "dark" : prefersDark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return { isDark, toggle };
}
