import { PageHead } from "@/components/ui/PageHead";
import { EmptyState } from "@/components/ui/EmptyState";
import { MyTasksList } from "@/components/tasks/MyTasksList";
import { getCurrentEmployeeId, getMyTasks, getEmployees } from "@/lib/supabase/queries";

export default async function TasksPage() {
  const employeeId = await getCurrentEmployeeId();
  const [tasks, employees] = await Promise.all([
    employeeId ? getMyTasks(employeeId) : Promise.resolve([]),
    getEmployees(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="My Tasks" description="Everything assigned to you, across every project, soonest due date first." />
      {tasks.length === 0 ? (
        <EmptyState icon="check" message="Nothing assigned to you right now." />
      ) : (
        <MyTasksList tasks={tasks} employees={employees} />
      )}
    </div>
  );
}
