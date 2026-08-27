import { PageHead } from "@/components/ui/PageHead";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoleGate } from "@/components/shell/RoleGate";
import { getRebalanceCandidates } from "@/lib/supabase/tasks";
import { suggestRebalanceMoves } from "@/lib/rebalance";
import { RebalanceSuggestions } from "@/components/tasks/RebalanceSuggestions";
import { WorkloadClient } from "./WorkloadClient";

export default async function WorkloadPage() {
  const { entries, people, tasks } = await getRebalanceCandidates();
  const moves = suggestRebalanceMoves(people, tasks);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHead
        title="Workload"
        description="Committed hours as a share of each person's weekly capacity, across every project."
      />
      {entries.length === 0 ? (
        <EmptyState icon="check" message="No open tasks assigned to anyone right now." />
      ) : (
        <div className="space-y-6">
          <WorkloadClient entries={entries} />
          {moves.length > 0 ? (
            <RoleGate allow={["manager", "hr"]}>
              <RebalanceSuggestions moves={moves} />
            </RoleGate>
          ) : null}
        </div>
      )}
    </div>
  );
}
