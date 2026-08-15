import { PageHead } from "@/components/ui/PageHead";
import { EMPLOYEES } from "@/lib/employees";
import { FocusClient } from "./FocusClient";

export default function FocusPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Focus Mode"
        description="Adapt the workspace to how stretched someone currently is."
      />
      <FocusClient employees={EMPLOYEES} />
    </div>
  );
}
