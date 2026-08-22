import { notFound } from "next/navigation";
import { PageHead } from "@/components/ui/PageHead";
import { DeleteProjectButton } from "@/components/tasks/DeleteProjectButton";
import { ViewSwitcher, VIEW_KEYS } from "@/components/tasks/ViewSwitcher";
import { FilterBar } from "@/components/tasks/FilterBar";
import { getProject, getEmployees, getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getTasksForProjectRich, getLabels, getTaskViews } from "@/lib/supabase/tasks";
import { getVisibleEmployees } from "@/lib/supabase/people";
import { filterTasks, type TaskFilters } from "@/lib/tasks";
import { addDays, todayInTz } from "@/lib/date";
import { BoardClient } from "./BoardClient";
import { ListView } from "./ListView";
import { CalendarView } from "./CalendarView";
import { TimelineView } from "./TimelineView";
import type { Priority } from "@/types/task";

/**
 * One dataset, four lenses (P5). Filter state lives entirely in
 * searchParams — server-side filtering, a shareable URL, and a "saved
 * view" (task_views, 0013) that's just a name pointing at one of these
 * querystrings, rather than client state to restore.
 *
 * `/tasks/board/[projectId]` (the P3 route) now redirects here — see that
 * folder's page.tsx — because `/tasks/[taskId]` already existed, and
 * `/tasks/[projectId]/list` would collide with it at the segment level.
 */
export default async function ProjectViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; view: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId, view } = await params;
  if (!VIEW_KEYS.includes(view)) notFound();

  const sp = await searchParams;
  const asString = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filters: TaskFilters = {
    q: asString(sp.q),
    assigneeId: asString(sp.assignee),
    priority: asString(sp.priority) as Priority | undefined,
    labelId: asString(sp.label),
  };

  const [projectResult, tasks, employees, labels, savedViews, people, currentEmployeeId] = await Promise.all([
    getProject(projectId),
    getTasksForProjectRich(projectId),
    getEmployees(),
    getLabels(),
    getTaskViews(projectId),
    getVisibleEmployees(),
    getCurrentEmployeeId(),
  ]);

  if (!projectResult) notFound();

  const filteredTasks = filterTasks(tasks, filters);

  const searchString = (() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.assigneeId) params.set("assignee", filters.assigneeId);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.labelId) params.set("label", filters.labelId);
    const str = params.toString();
    return str ? `?${str}` : "";
  })();

  const today = todayInTz();
  const year = Number(asString(sp.year) ?? today.slice(0, 4));
  const month = Number(asString(sp.month) ?? today.slice(5, 7));
  const timelineEnd = addDays(today, 30);

  return (
    <div className="px-6 py-8">
      <PageHead
        title={projectResult.project.name}
        description="One dataset, four lenses — filters travel with you when you switch."
        actions={<DeleteProjectButton projectId={projectId} projectName={projectResult.project.name} />}
      />

      <div className="mb-4">
        <ViewSwitcher projectId={projectId} view={view} search={searchString} />
      </div>

      <FilterBar
        projectId={projectId}
        view={view}
        employees={employees}
        labels={labels}
        savedViews={savedViews}
        currentEmployeeId={currentEmployeeId}
      />

      {view === "list" && <ListView tasks={filteredTasks} />}

      {view === "board" && (
        <BoardClient
          projectId={projectId}
          sections={projectResult.sections}
          tasks={filteredTasks}
          employees={employees}
          labels={labels}
        />
      )}

      {view === "calendar" && (
        <CalendarView
          tasks={filteredTasks}
          year={year}
          month={month}
          projectId={projectId}
          view={view}
          search={searchString}
        />
      )}

      {view === "timeline" && (
        <TimelineView tasks={filteredTasks} people={people} rangeStart={today} rangeEnd={timelineEnd} />
      )}
    </div>
  );
}
