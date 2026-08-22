import { Card } from "@/components/ui/Card";
import { WorkloadBar } from "@/components/tasks/WorkloadBar";
import type { CapacityWorkloadEntry } from "@/lib/tasks";

export function WorkloadClient({ entries }: { entries: CapacityWorkloadEntry[] }) {
  return (
    <Card>
      <div className="space-y-4">
        {entries.map((e) => (
          <WorkloadBar
            key={e.employee_id}
            name={e.name}
            avatarColor={e.avatar_color}
            committedHours={e.committed_hours}
            capacityHours={e.capacity_hours}
            loadPct={e.load_pct}
            openCount={e.open_count}
            overdueCount={e.overdue_count}
          />
        ))}
      </div>
    </Card>
  );
}
