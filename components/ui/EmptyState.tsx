import type { IconName } from "@/components/icons/Icon";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";

/**
 * `action` is optional because most empty states here are genuinely terminal
 * — "You're caught up", "Nobody is currently flagged" — and inventing a
 * button for those would manufacture work rather than offer it. It exists for
 * the ones where the screen's whole purpose is unreachable without it: My
 * Tasks rendered "Nothing assigned to you right now" and no way to get to a
 * project, so the main productivity screen had no primary action at all.
 */
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: IconName;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center text-ink-mute">
      <Icon name={icon} size={24} />
      <p className="text-sm">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
