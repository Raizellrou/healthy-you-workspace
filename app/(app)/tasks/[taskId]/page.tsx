import { notFound } from "next/navigation";
import { getCurrentEmployeeId, getEmployees, getTaskDetail } from "@/lib/supabase/queries";
import { getTaskRichExtras, getLabels } from "@/lib/supabase/tasks";
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

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);

  return (
    <TaskDetailClient
      detail={detail}
      extras={extras}
      allLabels={allLabels}
      employees={employees}
      currentEmployeeName={currentEmployee?.name}
      currentEmployeeAvatarColor={currentEmployee?.avatarColor}
    />
  );
}
