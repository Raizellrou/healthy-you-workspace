"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/** True once hydrated on the client, false during SSR — without the
 *  setState-in-effect pattern React now flags. The subscription never fires;
 *  this exists purely so the client snapshot ("true") differs from the
 *  server snapshot ("false"). */
function useIsMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Single positioned, portaled container for every bottom-right toast in the
 * app — the nudge dock (`ToastDock`) and the action-toast queue
 * (`ToastViewport`) both render as plain, unpositioned children here rather
 * than each owning its own `fixed bottom-4 right-4 z-50` div. Two
 * independent containers at identical coordinates is exactly the collision
 * this component exists to prevent.
 *
 * `flex-col-reverse` stacks whichever children are present bottom-up in DOM
 * order, so a newer action toast appears at the corner and pushes earlier
 * entries — including a live nudge toast — upward, with no coordination
 * needed between the two dock components themselves.
 */
export function ToastStack({ children }: { children: ReactNode }) {
  // SSR has no `document.body` to portal into, and the app layout that
  // mounts this is a Server Component — skip the portal until hydrated.
  const mounted = useIsMounted();
  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end gap-2">
      {children}
    </div>,
    document.body
  );
}
