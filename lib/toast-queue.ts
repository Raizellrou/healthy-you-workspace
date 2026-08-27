/**
 * Pure queue logic for the action-toast system — no React import, so the
 * cap/eviction invariant can be tested directly rather than through renders.
 * `lib/toast-context.tsx` is the only caller.
 */

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  title: string;
  variant: ToastVariant;
  duration: number;
}

export const MAX_VISIBLE_TOASTS = 3;

/** Appends `toast`, evicting the oldest entry when the queue would exceed
 *  `MAX_VISIBLE_TOASTS`. */
export function enqueue(queue: Toast[], toast: Toast): Toast[] {
  const next = [...queue, toast];
  return next.length > MAX_VISIBLE_TOASTS ? next.slice(next.length - MAX_VISIBLE_TOASTS) : next;
}

/** Removes the toast with `id`. A no-op if it's already gone — dismissing a
 *  toast that already auto-expired must not throw or affect other entries. */
export function dismiss(queue: Toast[], id: string): Toast[] {
  return queue.filter((t) => t.id !== id);
}
