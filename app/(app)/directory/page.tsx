import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { DirectoryClient } from "./DirectoryClient";

export default async function DirectoryPage() {
  const employees = await getEmployees();
  const teamCount = new Set(employees.map((e) => e.team)).size;
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Directory"
        description={`${employees.length} people across ${teamCount} teams`}
      />
      <DirectoryClient employees={employees} />
    </div>
  );
}
