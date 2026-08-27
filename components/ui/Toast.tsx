import { Icon } from "@/components/icons/Icon";
import type { Toast as ToastData, ToastVariant } from "@/lib/toast-queue";

/** Presentational only — no context, no timers, so it renders and tests in
 *  isolation. `ToastViewport` owns the queue and dismiss wiring. */
const VARIANT_META: Record<ToastVariant, { icon: "check" | "alert-circle" | "info"; className: string }> = {
  success: { icon: "check", className: "bg-success-bg text-success" },
  error: { icon: "alert-circle", className: "bg-risk-critical/10 text-risk-critical" },
  info: { icon: "info", className: "bg-brand-soft text-brand-ink" },
};

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const meta = VARIANT_META[toast.variant];
  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className="animate-toast-in flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
        <Icon name={meta.icon} size={16} />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium text-ink">{toast.title}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-ink-mute hover:text-ink"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
