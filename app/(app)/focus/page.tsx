import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { FocusClient } from "./FocusClient";

export default async function FocusPage() {
  const employees = await getEmployees();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#87CEEB" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#3B8FB0" }}>
          Adapt · Productivity
        </span>
      </div>
      <PageHead
        title="Focus Mode"
        description="Adapt the workspace to how stretched someone currently is."
      />
      <FocusClient employees={employees} />
    </div>
  );
}
