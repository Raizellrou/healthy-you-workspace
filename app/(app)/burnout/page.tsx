import { PageHead } from "@/components/ui/PageHead";
import { getEmployees, getBurnoutHistory } from "@/lib/supabase/queries";
import { BurnoutClient } from "./BurnoutClient";

export default async function BurnoutPage() {
  const employees = await getEmployees();
  const histories = await Promise.all(
    employees.map((e) => getBurnoutHistory(e.id))
  );
  const historyByEmployee = Object.fromEntries(
    employees.map((e, i) => [e.id, histories[i]])
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Burnout Risk Analytics"
        description="A composite score across work streak, meeting load, off-hours messages, and time since PTO."
      />
      <BurnoutClient employees={employees} historyByEmployee={historyByEmployee} />
    </div>
  );
}
