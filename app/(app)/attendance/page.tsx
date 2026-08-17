import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getEmployees } from "@/lib/supabase/queries";
import type { Employee } from "@/types/employee";

function StatusGroup({
  label,
  color,
  employees,
}: {
  label: string;
  color: string;
  employees: Employee[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-sm font-bold text-ink">{label}</span>
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold"
          style={{ background: `${color}20`, color }}
        >
          {employees.length}
        </span>
      </div>
      {employees.length === 0 ? (
        <p className="px-4 py-4 text-xs text-ink-mute">Nobody in this group today.</p>
      ) : (
        <div>
          {employees.map((e, i) => {
            const meetingPct = e.available > 0 ? Math.round((e.meetingAvg / e.available) * 100) : 0;
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < employees.length - 1 ? "border-b border-line" : ""}`}
              >
                <Avatar name={e.name} color={e.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{e.name}</div>
                  <div className="text-xs text-ink-mute">{e.team}</div>
                </div>
                <div className="text-right">
                  <div
                    className="text-xs font-semibold"
                    style={{
                      color: meetingPct > 65 ? "#FF8C73" : meetingPct > 45 ? "#FFD700" : "var(--ink-mute)",
                    }}
                  >
                    {meetingPct}%
                  </div>
                  <div className="text-[10px] text-ink-mute">meetings</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default async function AttendancePage() {
  const employees = await getEmployees();
  const working = employees.filter((e) => e.worked);
  const onPto = employees.filter((e) => e.onPto);
  const off = employees.filter((e) => !e.worked && !e.onPto);
  const topStreaks = [...employees].sort((a, b) => b.streakDays - a.streakDays).slice(0, 5);

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead title="Attendance" description={`${dateStr} · Today's working status across the org`} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Working", value: working.length, color: "#87D380" },
          { label: "On PTO", value: onPto.length, color: "#C7A2E5" },
          { label: "Off today", value: off.length, color: "#FF8C73" },
          { label: "Total", value: employees.length, color: "#6F49A6" },
        ].map((t) => (
          <Card key={t.label}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">{t.label}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: t.color }}>
              {t.value}
            </span>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_260px]">
        <StatusGroup label="Working today" color="#87D380" employees={working} />
        <StatusGroup label="Off today" color="#FF8C73" employees={off} />
        <div className="flex flex-col gap-4">
          <StatusGroup label="On PTO" color="#C7A2E5" employees={onPto} />
          <Card>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-mute">Top attendance streaks</div>
            <div className="space-y-2">
              {topStreaks.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Avatar name={e.name} color={e.avatarColor} size={26} />
                  <span className="flex-1 truncate text-xs text-ink">{e.name.split(" ")[0]}</span>
                  <span className="text-xs font-bold" style={{ color: "#FFD700" }}>
                    {e.streakDays}d
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
