import { PageHead } from "@/components/ui/PageHead";
import { getEmployees, getBurnoutHistory } from "@/lib/supabase/queries";
import { computeBurnout } from "@/lib/burnout";
import { BurnoutClient } from "./BurnoutClient";

export default async function BurnoutPage() {
  const employees = await getEmployees();
  const histories = await Promise.all(
    employees.map((e) => getBurnoutHistory(e.id))
  );
  const historyByEmployee = Object.fromEntries(
    employees.map((e, i) => [e.id, histories[i]])
  );

  const scores = employees.map((e) => computeBurnout(e));
  const avgScore = scores.length === 0 ? 0 : Math.round(scores.reduce((s, r) => s + r.composite, 0) / scores.length);
  const criticalCount = scores.filter((s) => s.band === "critical").length;
  const highCount = scores.filter((s) => s.band === "high").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#6F49A6" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6F49A6" }}>
          Predict · Pillar 1
        </span>
      </div>
      <PageHead
        title="Burnout Risk Analytics"
        description="A composite score across work streak, meeting load, off-hours messages, and time since PTO."
        actions={
          <div className="flex gap-2">
            {[
              { label: "Avg score", value: avgScore, color: "#6F49A6" },
              { label: "Critical", value: criticalCount, color: "#FF8C73" },
              { label: "High risk", value: highCount, color: "#FFD700" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-center">
                <div className="text-lg font-bold leading-tight" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-[10px] text-ink-mute">{s.label}</div>
              </div>
            ))}
          </div>
        }
      />
      <BurnoutClient employees={employees} historyByEmployee={historyByEmployee} />
    </div>
  );
}
