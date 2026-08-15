import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { NUDGE_META } from "@/lib/constants";
import type { NudgeType } from "@/types/nudge";

export function NudgeToastCard({
  type,
  onDone,
  onSnooze,
  onDismiss,
}: {
  type: NudgeType;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss?: () => void;
}) {
  const meta = NUDGE_META[type];
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-in flex w-full max-w-sm gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name={meta.icon as never} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{meta.title}</p>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-ink-mute hover:text-ink"
            >
              <Icon name="x" size={14} />
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">{meta.body}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={onSnooze}>
            Snooze 10 min
          </Button>
          <Button size="sm" variant="primary" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
