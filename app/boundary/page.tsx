import { PageHead } from "@/components/ui/PageHead";
import { EMPLOYEES } from "@/lib/employees";
import { BoundaryClient } from "./BoundaryClient";

export default function BoundaryPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Right to Disconnect"
        description="Compose a message that lands inside someone's working hours."
      />
      <BoundaryClient employees={EMPLOYEES} />
    </div>
  );
}
