import type { InputHTMLAttributes } from "react";
import { CONTROL_CLASSES, CONTROL_INVALID_CLASSES } from "./controlStyles";

export function Input({
  className = "",
  "aria-invalid": invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      aria-invalid={invalid}
      className={`${CONTROL_CLASSES} ${invalid ? CONTROL_INVALID_CLASSES : ""} ${className}`}
      {...props}
    />
  );
}
