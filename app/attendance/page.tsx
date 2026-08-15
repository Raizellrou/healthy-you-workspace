import { PageHead } from "@/components/ui/PageHead";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { EMPLOYEES } from "@/lib/employees";

export default function AttendancePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Attendance"
        description="Today's working status across the org."
      />

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs font-medium uppercase tracking-wide text-ink-mute">
            <tr>
              <th scope="col" className="px-4 py-3">Employee</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Meeting hours</th>
              <th scope="col" className="px-4 py-3">Off-hours messages</th>
            </tr>
          </thead>
          <tbody>
            {EMPLOYEES.map((e) => (
              <tr key={e.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={e.name} color={e.avatarColor} />
                    <div>
                      <div className="font-medium text-ink">{e.name}</div>
                      <div className="text-xs text-ink-mute">{e.team}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {e.worked ? (
                    <Chip tone="success">Working today</Chip>
                  ) : (
                    <Chip tone="warning">Off · PTO</Chip>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-ink-soft">{e.meeting.toFixed(1)}h</td>
                <td className="px-4 py-3 font-mono text-ink-soft">{e.offHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
