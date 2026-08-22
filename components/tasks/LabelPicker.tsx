"use client";

import type { Label } from "@/types/task";

export function LabelPicker({
  labels,
  selectedIds,
  onChange,
  disabled,
}: {
  labels: Label[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  if (labels.length === 0) {
    return <p className="text-xs text-ink-mute">No labels yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => {
        const selected = selectedIds.includes(label.id);
        return (
          <button
            key={label.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(label.id)}
            aria-pressed={selected}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              selected ? "border-transparent text-white" : "border-line text-ink-soft hover:border-brand"
            }`}
            style={selected ? { background: label.color } : undefined}
          >
            {label.name}
          </button>
        );
      })}
    </div>
  );
}
