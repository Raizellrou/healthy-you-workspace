import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { DirectoryClient } from "./DirectoryClient";

export default async function DirectoryPage() {
  const employees = await getEmployees();
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Employee Directory"
        description="Search the roster by name or team."
      />
      <DirectoryClient employees={employees} />
    </div>
  );
}
