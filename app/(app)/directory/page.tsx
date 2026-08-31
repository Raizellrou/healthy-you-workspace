import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson, getTeams } from "@/lib/supabase/people";
import { canSee } from "@/lib/authz";
import { DirectoryClient } from "./DirectoryClient";

export default async function DirectoryPage() {
  const [employees, viewer, teams] = await Promise.all([getEmployees(), getCurrentPerson(), getTeams()]);
  const teamCount = new Set(employees.map((e) => e.team)).size;

  /**
   * Which people's burnout band this viewer may see.
   *
   * The Directory used to render a band chip on all 28 cards for everyone,
   * while /burnout correctly scopes to self and /mood refuses to show a team
   * average until three people have checked in. A per-person band is not an
   * aggregate — it is an individual wellbeing signal attached to a named
   * colleague — so the Directory was the one screen contradicting the stance
   * the rest of the product takes.
   *
   * Decided server-side and passed down as a set of ids: the client component
   * never receives a band it isn't allowed to draw. This is UI gating, not
   * the security boundary — RLS remains that — but the data here is already
   * readable, so this is the layer that decides.
   *
   * Employee carries a team *name* and no teamId, so the id is resolved by
   * name rather than widening the type. getCurrentPerson is already called in
   * the app layout and is cache()-wrapped, so only getTeams costs a round
   * trip on this route.
   */
  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
  const bandVisibleIds = viewer
    ? new Set(
        employees
          .filter((e) => canSee(viewer, { id: e.id, teamId: teamIdByName.get(e.team) ?? null }, teams))
          .map((e) => e.id)
      )
    : new Set<string>();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Directory"
        description={`${employees.length} people across ${teamCount} teams`}
      />
      <DirectoryClient employees={employees} bandVisibleIds={bandVisibleIds} />
    </div>
  );
}
