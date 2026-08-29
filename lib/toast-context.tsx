"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionResult } from "@/lib/action-result";
import { enqueue, dismiss as dismissFromQueue, type Toast, type ToastVariant } from "@/lib/toast-queue";

export type { Toast, ToastVariant };

interface ToastInput {
  title: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // One timer per live toast id — cleared on manual dismiss so a toast
  // dismissed early can never fire a delayed auto-dismiss that evicts
  // whichever newer toast has since taken its place.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((cur) => dismissFromQueue(cur, id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const duration = input.duration ?? DEFAULT_DURATION;
      const entry: Toast = {
        id,
        title: input.title,
        variant: input.variant ?? "info",
        duration,
        action: input.action,
      };
      setToasts((cur) => enqueue(cur, entry));
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): { toast: (input: ToastInput) => void; dismiss: (id: string) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return { toast: ctx.toast, dismiss: ctx.dismiss };
}

/** Internal — only `ToastViewport` needs the live list. */
export function useToastList(): Toast[] {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastList must be used within ToastProvider");
  return ctx.toasts;
}

/**
 * The single call-site pattern for every Server Action result: every action
 * already returns `{ ok, error }` (lib/action-result.ts), so this is the one
 * place that branches on it, rather than ~28 components each re-writing
 * `if (!result.ok) { ... }`.
 *
 * `onError` lets an optimistic component roll back its local state in the
 * same place it reports the failure, so the two can't drift apart.
 */
export function useActionToast() {
  const { toast } = useToast();
  return useCallback(
    async function run<T extends ActionResult>(
      fn: () => Promise<T>,
      options?: { success?: string; onError?: (result: T) => void }
    ): Promise<T> {
      const result = await fn();
      if (!result.ok) {
        toast({ title: result.error ?? "Something went wrong.", variant: "error" });
        options?.onError?.(result);
      } else if (options?.success) {
        toast({ title: options.success, variant: "success" });
      }
      return result;
    },
    [toast]
  );
}
