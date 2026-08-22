import type { TextareaHTMLAttributes } from "react";
import { CONTROL_CLASSES, CONTROL_INVALID_CLASSES } from "./controlStyles";

export function Textarea({
  className = "",
  rows = 3,
  "aria-invalid": invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid}
      className={`${CONTROL_CLASSES} resize-y ${invalid ? CONTROL_INVALID_CLASSES : ""} ${className}`}
      {...props}
    />
  );
}
