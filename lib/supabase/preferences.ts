import { createClient } from "@/lib/supabase/server";

/** Sibling to the frozen lib/supabase/queries.ts. ui_preferences is new (0016/P7). */

export interface UiPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: number;
  density: "comfortable" | "compact";
  singleColumn: boolean;
  mutedPalette: boolean;
  hideAvatars: boolean;
  defaultTaskView: "list" | "board" | "calendar" | "timeline";
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  reducedMotion: false,
  highContrast: false,
  fontScale: 1,
  density: "comfortable",
  singleColumn: false,
  mutedPalette: false,
  hideAvatars: false,
  defaultTaskView: "board",
};

export async function getUiPreferences(employeeId: string): Promise<UiPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ui_preferences")
    .select(
      "reduced_motion, high_contrast, font_scale, density, single_column, muted_palette, hide_avatars, default_task_view"
    )
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (!data) return DEFAULT_UI_PREFERENCES;
  return {
    reducedMotion: data.reduced_motion as boolean,
    highContrast: data.high_contrast as boolean,
    fontScale: Number(data.font_scale),
    density: data.density as "comfortable" | "compact",
    singleColumn: data.single_column as boolean,
    mutedPalette: data.muted_palette as boolean,
    hideAvatars: data.hide_avatars as boolean,
    defaultTaskView: data.default_task_view as "list" | "board" | "calendar" | "timeline",
  };
}
