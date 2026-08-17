import { PageHead } from "@/components/ui/PageHead";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWorkload } from "@/lib/supabase/queries";
import { WorkloadClient } from "./WorkloadClient";

export default async function WorkloadPage() {
  const entries = await getWorkload();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHead title="Workload" description="Open task count per person, across every project." />
      {entries.length === 0 ? (
        <EmptyState icon="check" message="No open tasks assigned to anyone right now." />
      ) : (
        <WorkloadClient entries={entries} />
      )}
    </div>
  );
}
