"use client";

import { useEffect } from "react";
import type { UiPreferences } from "@/lib/supabase/preferences";

/**
 * Applies persisted ui_preferences to <html> via data-attributes and a
 * custom property — the same document.documentElement mechanism
 * components/shell/ThemeToggle.tsx already uses for data-theme, just
 * server-sourced instead of localStorage. Renders nothing.
 *
 * Every preference except hide_avatars is wired to real CSS here
 * (app/globals.css): reduced_motion, high_contrast, muted_palette and
 * font_scale as before, plus density (retunes --card-pad, which
 * components/ui/Card.tsx reads) and single_column (collapses content grids
 * inside <main>). hide_avatars remains persisted-but-unapplied — it needs
 * per-component decisions about what replaces an avatar rather than a
 * single cascade rule, so it is left honestly unwired rather than
 * half-done.
 */
export function UiPreferencesApplier({ prefs }: { prefs: UiPreferences }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-reduced-motion", String(prefs.reducedMotion));
    root.setAttribute("data-high-contrast", String(prefs.highContrast));
    root.setAttribute("data-muted-palette", String(prefs.mutedPalette));
    root.setAttribute("data-density", prefs.density);
    root.setAttribute("data-single-column", String(prefs.singleColumn));
    root.style.setProperty("--font-scale", String(prefs.fontScale));
  }, [
    prefs.reducedMotion,
    prefs.highContrast,
    prefs.mutedPalette,
    prefs.density,
    prefs.singleColumn,
    prefs.fontScale,
  ]);

  return null;
}
