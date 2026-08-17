import { notFound } from "next/navigation";
import { getCurrentEmployeeId, getEmployees, getTaskDetail } from "@/lib/supabase/queries";
import { TaskDetailClient } from "./TaskDetailClient";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [detail, employees, currentEmployeeId] = await Promise.all([
    getTaskDetail(taskId),
    getEmployees(),
    getCurrentEmployeeId(),
  ]);

  if (!detail) notFound();

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);

  return (
    <TaskDetailClient
      detail={detail}
      employees={employees}
      currentEmployeeName={currentEmployee?.name}
      currentEmployeeAvatarColor={currentEmployee?.avatarColor}
    />
  );
}
