import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { getCurrentPerson, getTeams, getVisibleEmployees } from "@/lib/supabase/people";
import { isHr } from "@/lib/authz";
import { TeamsClient } from "./TeamsClient";

/**
 * HR-only. Gated here rather than by RoleGate — a real 404 for anyone else
 * beats an empty page, and this is the entire route's purpose, not one
 * piece of a shared screen.
 *
 * RLS is the actual boundary: getVisibleEmployees() only returns the full
 * org because the signed-in caller is HR (0010's can_see_employee). This
 * check exists so a non-HR visitor gets a 404 instead of a page that
 * renders with an empty/self-only list.
 */
export default async function TeamsPage() {
  const me = await getCurrentPerson();
  if (!me || !isHr(me.appRole)) notFound();

  const [teams, employees] = await Promise.all([getTeams(), getVisibleEmployees()]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHead
        title="Teams"
        description="Assign team managers and HR access. Changes take effect immediately. RLS enforces the new scope on every screen, not just this one."
      />
      <TeamsClient teams={teams} employees={employees} currentPersonId={me.id} />
    </div>
  );
}
