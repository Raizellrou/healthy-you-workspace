import type { SelectHTMLAttributes } from "react";
import { CONTROL_CLASSES, CONTROL_INVALID_CLASSES } from "./controlStyles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A real `<select>`, deliberately. It gets native keyboard behaviour and the
 * platform picker on mobile, which a custom listbox would have to re-earn.
 * `Menu` covers the cases that genuinely need custom rendering.
 */
export function Select({
  options,
  placeholder,
  className = "",
  "aria-invalid": invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <select
      aria-invalid={invalid}
      className={`${CONTROL_CLASSES} appearance-none bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${invalid ? CONTROL_INVALID_CLASSES : ""} ${className}`}
      style={{
        // Inline chevron as a data URI: no external request, and `currentColor`
        // isn't available to background images so it tracks the token instead.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2393a1b4' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {placeholder && (
        <option value="">{placeholder}</option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
