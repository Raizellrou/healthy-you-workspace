import type { Employee } from "@/types/employee";

export function AssigneePicker({
  employees,
  value,
  onChange,
  disabled,
}: {
  employees: Employee[];
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
      <option value="">Unassigned</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}
