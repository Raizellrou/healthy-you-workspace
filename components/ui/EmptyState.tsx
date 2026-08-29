import type { IconName } from "@/components/icons/Icon";
import { Icon } from "@/components/icons/Icon";

export function EmptyState({
  icon,
  message,
}: {
  icon: IconName;
  message: string;
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center text-ink-mute">
      <Icon name={icon} size={24} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
