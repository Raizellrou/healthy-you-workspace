import { redirect } from "next/navigation";

/**
 * Legacy P3 route. P5 restructured task views to
 * `/tasks/project/[projectId]/[view]` (list/board/calendar/timeline) —
 * `/tasks/[projectId]/list` would have collided with the existing
 * `/tasks/[taskId]` segment. Keeps old links/bookmarks working.
 */
export default async function LegacyBoardRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/tasks/project/${projectId}/board`);
}
