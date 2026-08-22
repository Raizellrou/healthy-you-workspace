"use client";

import type { ReactNode } from "react";
import { useId } from "react";

/**
 * Label + control + hint/error, wired together for screen readers.
 *
 * Pass the generated id and describedBy through to the control via the render
 * prop so the association is impossible to forget:
 *
 *     <Field label="Title" error={err}>
 *       {(p) => <Input {...p} value={title} onChange={…} />}
 *     </Field>
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    required?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-risk-critical">
            *
          </span>
        )}
      </label>

      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
        required,
      })}

      {message && (
        <p
          id={messageId}
          className={`text-xs ${error ? "text-risk-critical" : "text-ink-mute"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
