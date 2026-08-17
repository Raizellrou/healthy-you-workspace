import { Card } from "@/components/ui/Card";
import { WorkloadBar } from "@/components/tasks/WorkloadBar";
import type { WorkloadEntry } from "@/lib/tasks";

export function WorkloadClient({ entries }: { entries: WorkloadEntry[] }) {
  const maxCount = entries.reduce((max, e) => Math.max(max, e.open_count), 0);

  return (
    <Card>
      <div className="space-y-4">
        {entries.map((e) => (
          <WorkloadBar
            key={e.employee_id}
            name={e.name}
            avatarColor={e.avatar_color}
            openCount={e.open_count}
            highCount={e.high_count}
            maxCount={maxCount}
          />
        ))}
      </div>
    </Card>
  );
}
