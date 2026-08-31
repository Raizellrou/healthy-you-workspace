"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Three-state theme, shared by every control that can change it
 * (components/shell/ThemeToggle.tsx in Appearance settings,
 * components/shell/UserMenu.tsx in the account menu, and
 * app/landing/LandingThemeToggle.tsx on the public page).
 *
 * "system" is the default and follows the device. It is represented by the
 * *absence* of both the localStorage key and the `data-theme` attribute —
 * app/globals.css is already written for exactly that: the bare `:root`
 * block carries light, and `@media (prefers-color-scheme: dark)
 * :root:not([data-theme="light"])` carries dark, so an un-stamped document
 * tracks the OS with no JavaScript involved at all. Explicit choices stamp
 * `data-theme` and win over both.
 *
 * That contract is shared with app/layout.tsx's THEME_INIT_SCRIPT, which
 * reads the same key before first paint to avoid a flash of the wrong
 * theme, and which deliberately stamps nothing when the key is missing.
 * Writing the attribute and localStorage together, in this exact shape, is
 * load-bearing in both directions — clearing them is what returns a person
 * to system mode.
 *
 * The initial read is deferred to an effect on purpose: localStorage and
 * matchMedia don't exist during SSR, so the server pass and the first
 * client render must agree on the "system"/"light" defaults before this
 * corrects them. The paint is already correct by then via the init script;
 * only the controls' own labels settle a tick later.
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    // Private windows and blocked site data both throw on access rather
    // than returning null. Falling back to system is the right default.
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(readStoredMode());
    setSystemDark(systemPrefersDark());

    // Without this listener, someone in system mode who flips their OS
    // between light and dark — or whose OS does it for them on a schedule,
    // which is the common case — keeps the old theme until they happen to
    // reload. The CSS media query repaints on its own; this only keeps the
    // controls' labels honest about what is showing.
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);

    // A change made in another tab should not leave this one disagreeing
    // with what is actually on screen.
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setMode(readStoredMode());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    const root = document.documentElement;
    try {
      if (next === "system") {
        // Both must go: the attribute is what overrides the media query,
        // and the key is what the init script would re-apply on next load.
        root.removeAttribute("data-theme");
        localStorage.removeItem(STORAGE_KEY);
      } else {
        root.setAttribute("data-theme", next);
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Storage can be unavailable; the attribute still applies for this
      // page view, so the click is never a no-op.
      if (next === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", next);
    }
  }, []);

  const resolved: ResolvedTheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  const isDark = resolved === "dark";

  /** Flips to the opposite of what is currently *showing*, which leaves
   *  system mode for an explicit one. For returning to system, call
   *  setTheme("system") — the segmented control in Appearance settings and
   *  the account menu both offer it. */
  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  return { mode, resolved, isDark, systemDark, setTheme, toggle };
}
