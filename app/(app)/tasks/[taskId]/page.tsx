import { notFound } from "next/navigation";
import { getCurrentEmployeeId, getEmployees, getTaskDetail } from "@/lib/supabase/queries";
import { getTaskRichExtras, getLabels, getTasksForProjectRich } from "@/lib/supabase/tasks";
import { getCurrentPerson } from "@/lib/supabase/people";
import { canManageProjects } from "@/lib/authz";
import { isUuid } from "@/lib/uuid";
import { TaskDetailClient } from "./TaskDetailClient";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  if (!isUuid(taskId)) notFound();

  const [detail, extras, allLabels, employees, currentEmployeeId, currentPerson] = await Promise.all([
    getTaskDetail(taskId),
    getTaskRichExtras(taskId),
    getLabels(),
    getEmployees(),
    getCurrentEmployeeId(),
    getCurrentPerson(),
  ]);
  const canDelete = currentPerson ? canManageProjects(currentPerson.appRole) : false;

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
      canDelete={canDelete}
    />
  );
}
