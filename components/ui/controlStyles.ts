/**
 * Shared form-control styling.
 *
 * Kept in its own module (rather than beside `Field`) because `Field` is a
 * Client Component — importing a plain constant across that boundary would
 * turn every consumer into a client reference for no reason. Input, Textarea
 * and Select stay usable from Server Components this way.
 */
export const CONTROL_CLASSES =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-mute transition-colors hover:border-line-strong focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-mute";

export const CONTROL_INVALID_CLASSES =
  "border-risk-critical hover:border-risk-critical focus:border-risk-critical";
