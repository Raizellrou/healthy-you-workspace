"use client";

import { useEffect } from "react";
import type { UiPreferences } from "@/lib/supabase/preferences";
import type { FocusMode } from "@/lib/supabase/focus";

/**
 * Applies persisted ui_preferences to <html> via data-attributes and a
 * custom property — the same document.documentElement mechanism
 * components/shell/ThemeToggle.tsx already uses for data-theme, just
 * server-sourced instead of localStorage. Renders nothing.
 *
 * Every preference is wired to real CSS here (app/globals.css):
 * reduced_motion, high_contrast, muted_palette and font_scale as before,
 * plus density (retunes --card-pad, which components/ui/Card.tsx reads),
 * single_column (collapses content grids inside <main>), and hide_avatars
 * (hides every [data-avatar] element — safe as a single cascade rule since
 * every call site already shows the person's name as adjacent visible
 * text, per components/ui/Avatar.tsx).
 *
 * `focusMode` is a second, independent input layered on top of the same
 * attributes rather than a preference of its own — a session-scoped
 * override, not a setting. Before this, the /focus page's "Focus" and
 * "Calm" buttons only persisted a mode string and described what they'd
 * do; nothing outside that page actually read it. OR-ing it in here means
 * an open Focus session forces single-column everywhere for its duration
 * without touching (or overwriting) the user's own manual preference —
 * ending the session reverts to whatever they had set, since the effective
 * value is recomputed from `prefs` + `focusMode` together, not stored.
 */
export function UiPreferencesApplier({ prefs, focusMode }: { prefs: UiPreferences; focusMode: FocusMode | null }) {
  const forceSingleColumn = focusMode === "focus";
  const forceCalm = focusMode === "calm";

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-reduced-motion", String(prefs.reducedMotion || forceCalm));
    root.setAttribute("data-high-contrast", String(prefs.highContrast));
    root.setAttribute("data-muted-palette", String(prefs.mutedPalette || forceCalm));
    root.setAttribute("data-density", prefs.density);
    root.setAttribute("data-single-column", String(prefs.singleColumn || forceSingleColumn));
    root.setAttribute("data-hide-avatars", String(prefs.hideAvatars));
    root.style.setProperty("--font-scale", String(prefs.fontScale));
  }, [
    prefs.reducedMotion,
    prefs.highContrast,
    prefs.mutedPalette,
    prefs.density,
    prefs.singleColumn,
    prefs.hideAvatars,
    prefs.fontScale,
    forceSingleColumn,
    forceCalm,
  ]);

  return null;
}
