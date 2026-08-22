"use client";

import { useEffect } from "react";
import type { UiPreferences } from "@/lib/supabase/preferences";

/**
 * Applies persisted ui_preferences to <html> via data-attributes and a
 * custom property — the same document.documentElement mechanism
 * components/shell/ThemeToggle.tsx already uses for data-theme, just
 * server-sourced instead of localStorage. Renders nothing.
 *
 * Only reduced_motion/high_contrast/font_scale/muted_palette are wired to
 * real CSS here (app/globals.css). density/single_column/hide_avatars are
 * persisted and editable in Settings but not yet visually applied
 * everywhere — deliberately scoped down rather than half-wiring every
 * layout in this pass.
 */
export function UiPreferencesApplier({ prefs }: { prefs: UiPreferences }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-reduced-motion", String(prefs.reducedMotion));
    root.setAttribute("data-high-contrast", String(prefs.highContrast));
    root.setAttribute("data-muted-palette", String(prefs.mutedPalette));
    root.style.setProperty("--font-scale", String(prefs.fontScale));
  }, [prefs.reducedMotion, prefs.highContrast, prefs.mutedPalette, prefs.fontScale]);

  return null;
}
