import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Icon } from "@/components/icons/Icon";
import { getEmployees } from "@/lib/supabase/queries";
import { PILLARS } from "@/lib/pillars";

export default async function DashboardPage() {
  const employees = await getEmployees();
  const headcount = employees.length;
  const teamCount = new Set(employees.map((e) => e.team)).size;
  const workingToday = employees.filter((e) => e.worked).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Dashboard"
        description="A snapshot of the org and the wellbeing pillars available to your team."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon="users" label="Headcount" value={headcount} />
        <Stat icon="grid" label="Teams" value={teamCount} />
        <Stat
          icon="calendar"
          label="Working today"
          value={`${workingToday} of ${headcount}`}
        />
        <Stat icon="activity" label="Pillar features" value={PILLARS.length} />
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-ink">Wellbeing pillars</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <Link key={p.href} href={p.href} className="block">
            <Card className="h-full transition-colors hover:border-brand">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Icon name={p.icon} size={18} />
                </span>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">
                    {p.category}
                  </div>
                  <div className="text-sm font-semibold text-ink">{p.label}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-soft">{p.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
