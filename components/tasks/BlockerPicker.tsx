import type { Task } from "@/types/task";

export function BlockerPicker({
  candidates,
  value,
  onChange,
  disabled,
}: {
  candidates: Task[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
    >
      <option value="">Not blocked</option>
      {candidates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
          {t.done ? " (done)" : ""}
        </option>
      ))}
    </select>
  );
}
