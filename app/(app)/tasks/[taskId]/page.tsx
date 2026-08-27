import { notFound } from "next/navigation";
import { getCurrentEmployeeId, getEmployees, getTaskDetail } from "@/lib/supabase/queries";
import { getTaskRichExtras, getLabels, getTasksForProjectRich } from "@/lib/supabase/tasks";
import { TaskDetailClient } from "./TaskDetailClient";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [detail, extras, allLabels, employees, currentEmployeeId] = await Promise.all([
    getTaskDetail(taskId),
    getTaskRichExtras(taskId),
    getLabels(),
    getEmployees(),
    getCurrentEmployeeId(),
  ]);

  if (!detail || !extras) notFound();

  // Blocker candidates are scoped to the same project — setBlockedBy
  // rejects a cross-project blocker anyway, so there's no point offering
  // one here.
  const projectTasks = await getTasksForProjectRich(detail.project.id);
  const blockerCandidates = projectTasks.filter((t) => t.id !== taskId);

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);

  return (
    <TaskDetailClient
      detail={detail}
      extras={extras}
      allLabels={allLabels}
      employees={employees}
      blockerCandidates={blockerCandidates}
      currentEmployeeName={currentEmployee?.name}
      currentEmployeeAvatarColor={currentEmployee?.avatarColor}
    />
  );
}
