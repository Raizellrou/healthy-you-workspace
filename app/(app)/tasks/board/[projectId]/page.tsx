import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { DeleteProjectButton } from "@/components/tasks/DeleteProjectButton";
import { getProject, getTasksForProject } from "@/lib/supabase/queries";
import { BoardClient } from "./BoardClient";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [projectResult, tasks] = await Promise.all([getProject(projectId), getTasksForProject(projectId)]);

  if (!projectResult) notFound();

  return (
    <div className="px-6 py-8">
      <PageHead
        title={projectResult.project.name}
        description="Drag cards between columns to update their status."
        actions={<DeleteProjectButton projectId={projectId} projectName={projectResult.project.name} />}
      />
      <BoardClient projectId={projectId} sections={projectResult.sections} tasks={tasks} />
    </div>
  );
}
