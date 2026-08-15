import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { FocusClient } from "./FocusClient";

export default async function FocusPage() {
  const employees = await getEmployees();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Focus Mode"
        description="Adapt the workspace to how stretched someone currently is."
      />
      <FocusClient employees={employees} />
    </div>
  );
}
