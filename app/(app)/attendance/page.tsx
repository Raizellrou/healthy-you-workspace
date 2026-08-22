import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TimesheetBars } from "@/components/attendance/TimesheetBars";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getCurrentPerson, getVisibleEmployees, getTeams } from "@/lib/supabase/people";
import { getVisibleOpenSessions, getAttendanceSignals, getMyRollups } from "@/lib/supabase/attendance";
import { visibleTo, scopeLabel } from "@/lib/authz";
import { todayInTz, fmtDuration } from "@/lib/date";
import type { Person } from "@/types/person";

function PersonGroup({
  label,
  color,
  people,
  meta,
}: {
  label: string;
  color: string;
  people: Person[];
  meta?: (p: Person) => string;
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
          {people.length}
        </span>
      </div>
      {people.length === 0 ? (
        <p className="px-4 py-4 text-xs text-ink-mute">Nobody here right now.</p>
      ) : (
        <div>
          {people.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${i < people.length - 1 ? "border-b border-line" : ""}`}
            >
              <Avatar name={p.name} color={p.avatarColor} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                <div className="text-xs text-ink-mute">{p.team}</div>
              </div>
              {meta ? <div className="text-right text-xs font-semibold text-ink-mute">{meta(p)}</div> : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default async function AttendancePage() {
  const [currentPerson, people, teams, currentEmployeeId] = await Promise.all([
    getCurrentPerson(),
    getVisibleEmployees(),
    getTeams(),
    getCurrentEmployeeId(),
  ]);

  // `getVisibleEmployees()` reads the `employees` table, whose SELECT policy
  // is deliberately org-wide (0002 — the Directory needs to list everyone),
  // so it always returns all 24 regardless of role. The pure `visibleTo`
  // mirror of the RLS scoping (0010) is what narrows the ROSTER shown here
  // to self/team/org — the P2 plan flagged this "scoped to your team"
  // mitigation as needed for exactly this kind of screen and it was never
  // implemented; this is that fix, applied here and on the burnout page.
  const visiblePeople = currentPerson ? visibleTo(currentPerson, people, (p) => p, teams) : [];
  const visibleIds = visiblePeople.map((p) => p.id);
  const today = todayInTz(currentPerson?.timezone);

  const [openSessions, signals, myRollups] = await Promise.all([
    getVisibleOpenSessions(),
    getAttendanceSignals(
      visibleIds,
      new Map(visiblePeople.map((p) => [p.id, p.timezone])),
      today
    ),
    currentEmployeeId ? getMyRollups(currentEmployeeId, 14) : Promise.resolve([]),
  ]);

  const openByEmployeeId = new Map(openSessions.map((s) => [s.employeeId, s]));
  const onPto = visiblePeople.filter((p) => signals.get(p.id)?.onPto);
  const onPtoIds = new Set(onPto.map((p) => p.id));
  const working = visiblePeople.filter((p) => openByEmployeeId.has(p.id));
  const off = visiblePeople.filter((p) => !openByEmployeeId.has(p.id) && !onPtoIds.has(p.id));

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Attendance"
        description={`${dateStr} · Real clock-in data, ${
          currentPerson ? scopeLabel(currentPerson.appRole).toLowerCase() : "scoped to you"
        }`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Clocked in now", value: working.length, color: "#87D380" },
          { label: "On PTO", value: onPto.length, color: "#C7A2E5" },
          { label: "Off today", value: off.length, color: "#FF8C73" },
          { label: "Total", value: visiblePeople.length, color: "#6F49A6" },
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PersonGroup
          label="Clocked in now"
          color="#87D380"
          people={working}
          meta={(p) => {
            const session = openByEmployeeId.get(p.id);
            if (!session) return "";
            const elapsed = Date.now() - new Date(session.clockIn).getTime();
            return session.onBreak ? "On break" : fmtDuration(elapsed);
          }}
        />
        <PersonGroup label="On PTO today" color="#C7A2E5" people={onPto} />
      </div>

      <div className="mt-4">
        <PersonGroup label="Off today" color="#FF8C73" people={off} />
      </div>

      {currentEmployeeId ? (
        <Card className="mt-6">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-mute">
            Your last 14 workdays
          </div>
          <TimesheetBars rollups={myRollups} />
        </Card>
      ) : null}
    </div>
  );
}
