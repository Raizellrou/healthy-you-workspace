"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "w-[min(26rem,calc(100vw-2rem))]",
  md: "w-[min(34rem,calc(100vw-2rem))]",
  lg: "w-[min(48rem,calc(100vw-2rem))]",
};

/**
 * Built on the native `<dialog>` element, which gives us the focus trap,
 * Esc-to-close, inertness of the rest of the page, and top-layer stacking for
 * free. Doing this by hand with a div would mean re-implementing all four, and
 * AGENTS.md rules out pulling in a UI library.
 *
 * `showModal()` must be called imperatively — the `open` attribute alone
 * renders a non-modal dialog with no backdrop and no focus management.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Esc fires `cancel`, not `close` — preventDefault so React state stays the
  // single source of truth and the dialog doesn't close behind our back.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      // The dialog box fills the whole element, so a click that lands on the
      // dialog itself is a click on the backdrop around it.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40 ${SIZE_CLASSES[size]}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id="modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="px-5 py-4">{children}</div>

      {footer && (
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/**
 * Replaces the `window.confirm` calls scattered through the tasks pillar.
 * Same shape as `Modal`, with the destructive action pre-wired.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-risk-critical/10 px-4 py-2 text-sm font-medium text-risk-critical transition-colors hover:bg-risk-critical/20 disabled:cursor-not-allowed disabled:text-ink-mute"
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  );
}
