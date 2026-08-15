import { PageHead } from "@/components/ui/PageHead";
import { EMPLOYEES } from "@/lib/employees";
import { BurnoutClient } from "./BurnoutClient";

export default function BurnoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Burnout Risk Analytics"
        description="A composite score across work streak, meeting load, off-hours messages, and time since PTO."
      />
      <BurnoutClient employees={EMPLOYEES} />
    </div>
  );
}
