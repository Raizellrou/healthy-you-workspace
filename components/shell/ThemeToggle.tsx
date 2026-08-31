"use client";

import { useTheme, type ThemeMode } from "@/lib/use-theme";

/**
 * Three-way theme control for Appearance settings.
 *
 * "System" is first and is the default, because it is the one most people
 * actually want: the device already knows, and it changes on a schedule
 * that a manual toggle can't follow. This used to be a binary light/dark
 * button, which meant a single click permanently opted someone out of
 * following their OS with no way back short of clearing site data.
 *
 * Rendered as a radiogroup rather than three buttons so arrow keys move
 * between the options and a screen reader announces "2 of 3" — this is a
 * choice among alternatives, not three independent actions.
 */

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { mode, resolved, setTheme } = useTheme();

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1">
        {OPTIONS.map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-mute">
        {mode === "system"
          ? `Following your device — currently ${resolved}.`
          : `Always ${mode}, whatever your device is set to.`}
      </p>
    </div>
  );
}
