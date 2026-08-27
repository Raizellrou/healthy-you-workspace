"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";

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
  // A stable per-instance id — a hardcoded "modal-title" broke the moment a
  // second Modal (e.g. a ConfirmModal) was mounted alongside this one:
  // aria-labelledby on the second dialog would resolve to the first one's
  // heading.
  const titleId = useId();

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
      aria-labelledby={titleId}
      // The dialog box fills the whole element, so a click that lands on the
      // dialog itself is a click on the backdrop around it.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40 ${SIZE_CLASSES[size]}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={titleId} className="text-base font-semibold text-ink">
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

interface ConfirmModalBaseProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  pending?: boolean;
}

/**
 * `tone` controls both button color and whether `confirmLabel` is required.
 * "destructive" (the original, and still the default) reads red with a
 * "Delete" fallback — correct for the two `window.confirm` replacements this
 * component was built for. "default" is for consequential-but-reversible
 * confirms (mark all read, assign a manager) where red styling would be
 * false alarm fatigue; `confirmLabel` is required there since "Delete" is
 * never the right word for one of those actions.
 */
type ConfirmModalProps =
  | (ConfirmModalBaseProps & { tone?: "destructive"; confirmLabel?: string })
  | (ConfirmModalBaseProps & { tone: "default"; confirmLabel: string });

/**
 * Replaces the `window.confirm` calls scattered through the tasks pillar.
 * Same shape as `Modal`, with the confirm action pre-wired.
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  tone = "destructive",
  pending = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Working…" : (confirmLabel ?? "Delete")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  );
}
