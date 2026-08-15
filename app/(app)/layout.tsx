import { Sidebar } from "@/components/shell/Sidebar";
import { ToastDock } from "@/components/nudges/ToastDock";
import { NudgeProvider } from "@/lib/nudge-context";
import { getEmployees } from "@/lib/supabase/queries";
import { computeBurnout } from "@/lib/burnout";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employees = await getEmployees();
  const hasCritical = employees.some((e) => computeBurnout(e).band === "critical");

  return (
    <NudgeProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar hasCritical={hasCritical} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <ToastDock />
    </NudgeProvider>
  );
}
