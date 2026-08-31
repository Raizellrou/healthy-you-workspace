import Link from "next/link";
import { PageHead } from "@/components/ui/PageHead";
import { EmptyState } from "@/components/ui/EmptyState";
import { MyTasksList } from "@/components/tasks/MyTasksList";
import { getCurrentEmployeeId, getMyTasks, getEmployees, getProjects } from "@/lib/supabase/queries";
import { getUiPreferences } from "@/lib/supabase/preferences";

export default async function TasksPage() {
  const employeeId = await getCurrentEmployeeId();
  const [tasks, employees, projects] = await Promise.all([
    employeeId ? getMyTasks(employeeId) : Promise.resolve([]),
    getEmployees(),
    getProjects(),
  ]);

  // Tasks are always created inside a project — TaskComposer needs a
  // projectId, its sections and its labels — so this page, which is
  // deliberately project-agnostic, can't host a composer itself. It can at
  // least point somewhere: previously the empty state was a dead end with no
  // route to the place where work gets added.
  const firstProject = projects[0];
  const { defaultTaskView } = employeeId
    ? await getUiPreferences(employeeId)
    : { defaultTaskView: "board" as const };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="My Tasks" description="Everything assigned to you, across every project, soonest due date first." />
      {tasks.length === 0 ? (
        <EmptyState
          icon="check"
          message="Nothing assigned to you right now."
          action={
            firstProject ? (
              <Link
                href={`/tasks/project/${firstProject.id}/${defaultTaskView}`}
                className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Open {firstProject.name}
              </Link>
            ) : null
          }
        />
      ) : (
        <MyTasksList tasks={tasks} employees={employees} />
      )}
    </div>
  );
}
