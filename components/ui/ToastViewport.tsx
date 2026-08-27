"use client";

import { Toast } from "@/components/ui/Toast";
import { useToast, useToastList } from "@/lib/toast-context";

/** Renders the live action-toast queue. No positioning of its own — nests
 *  inside `ToastStack`, which owns placement for this and the nudge dock. */
export function ToastViewport() {
  const toasts = useToastList();
  const { dismiss } = useToast();

  return (
    <>
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </>
  );
}
