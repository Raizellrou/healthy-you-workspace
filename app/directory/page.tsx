import { PageHead } from "@/components/ui/PageHead";
import { EMPLOYEES } from "@/lib/employees";
import { DirectoryClient } from "./DirectoryClient";

export default function DirectoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Employee Directory"
        description="Search the roster by name or team."
      />
      <DirectoryClient employees={EMPLOYEES} />
    </div>
  );
}
