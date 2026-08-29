"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { updateUiPreferences } from "@/app/(app)/settings/actions";
import { useActionToast } from "@/lib/toast-context";
import type { UiPreferences } from "@/lib/supabase/preferences";

const FONT_SCALES = [
  { value: "0.9", label: "Smaller" },
  { value: "1", label: "Default" },
  { value: "1.15", label: "Larger" },
  { value: "1.3", label: "Largest" },
];

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const TASK_VIEW_OPTIONS = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "calendar", label: "Calendar" },
  { value: "timeline", label: "Timeline" },
];

export function AppearanceClient({ prefs: initial }: { prefs: UiPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();
  const isDirty = (Object.keys(initial) as (keyof UiPreferences)[]).some((key) => prefs[key] !== initial[key]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function set<K extends keyof UiPreferences>(key: K, value: UiPreferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      await run(() => updateUiPreferences(prefs), { success: "Appearance saved." });
    });
  }

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <div className="mb-3 text-sm font-semibold text-ink">Theme</div>
        {/* Deliberately not part of the prefs form below: light/dark is a
            browser-local, apply-instantly choice (see ThemeToggle), not an
            account-level row that waits on Save. It used to live in every
            page's nav panel instead of here, where the rest of the
            appearance controls actually are. */}
        <div className="w-44">
          <ThemeToggle />
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-ink">Motion & contrast</div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Reduced motion</span>
            <Switch
              id="reduced-motion"
              label="Reduced motion"
              checked={prefs.reducedMotion}
              onChange={(v) => set("reducedMotion", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">High contrast</span>
            <Switch
              id="high-contrast"
              label="High contrast"
              checked={prefs.highContrast}
              onChange={(v) => set("highContrast", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Muted palette</span>
            <Switch
              id="muted-palette"
              label="Muted palette"
              checked={prefs.mutedPalette}
              onChange={(v) => set("mutedPalette", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-soft">Hide avatars</span>
            <Switch
              id="hide-avatars"
              label="Hide avatars"
              checked={prefs.hideAvatars}
              onChange={(v) => set("hideAvatars", v)}
            />
          </div>
        </div>
      </div>

      <Field label="Text size">
        {(props) => (
          <Select
            {...props}
            value={String(prefs.fontScale)}
            onChange={(e) => set("fontScale", Number(e.target.value))}
            options={FONT_SCALES}
          />
        )}
      </Field>

      <Field label="Density">
        {(props) => (
          <Select
            {...props}
            value={prefs.density}
            onChange={(e) => set("density", e.target.value as UiPreferences["density"])}
            options={DENSITY_OPTIONS}
          />
        )}
      </Field>

      <Field label="Default task view" hint="Which lens Tasks opens to first.">
        {(props) => (
          <Select
            {...props}
            value={prefs.defaultTaskView}
            onChange={(e) => set("defaultTaskView", e.target.value as UiPreferences["defaultTaskView"])}
            options={TASK_VIEW_OPTIONS}
          />
        )}
      </Field>

      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">Single column layout</span>
        <Switch
          id="single-column"
          label="Single column layout"
          checked={prefs.singleColumn}
          onChange={(v) => set("singleColumn", v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-ink-mute">
        Reduced motion, high contrast, muted palette, and text size apply everywhere immediately after saving. Density,
        single column, and hide avatars are saved but not yet wired into every screen.
      </p>
    </Card>
  );
}
