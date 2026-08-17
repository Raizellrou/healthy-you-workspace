import { PageHead } from "@/components/ui/PageHead";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/tasks/TaskRow";
import { getCurrentEmployeeId, getMyTasks } from "@/lib/supabase/queries";

export default async function TasksPage() {
  const employeeId = await getCurrentEmployeeId();
  const tasks = employeeId ? await getMyTasks(employeeId) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="My Tasks" description="Everything assigned to you, across every project, soonest due date first." />
      {tasks.length === 0 ? (
        <EmptyState icon="check" message="Nothing assigned to you right now." />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}
