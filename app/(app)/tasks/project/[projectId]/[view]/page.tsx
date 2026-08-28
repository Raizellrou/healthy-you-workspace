import { notFound } from "next/navigation";
import { ProjectMenu } from "@/components/tasks/ProjectMenu";
import { ViewSwitcher, VIEW_KEYS } from "@/components/tasks/ViewSwitcher";
import { FilterBar } from "@/components/tasks/FilterBar";
import { getProject, getEmployees, getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getTasksForProjectRich, getLabels, getTaskViews } from "@/lib/supabase/tasks";
import { getVisibleEmployees, getCurrentPerson } from "@/lib/supabase/people";
import { canManageProjects } from "@/lib/authz";
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

  const [projectResult, tasks, employees, labels, savedViews, people, currentEmployeeId, currentPerson] =
    await Promise.all([
      getProject(projectId),
      getTasksForProjectRich(projectId),
      getEmployees(),
      getLabels(),
      getTaskViews(projectId),
      getVisibleEmployees(),
      getCurrentEmployeeId(),
      getCurrentPerson(),
    ]);
  const canManage = currentPerson ? canManageProjects(currentPerson.appRole) : false;

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
    <div className="px-6 py-6">
      {/* One header row: identity, the four lenses, and project actions.
          The old stack was a title+description block, a separate view-tab
          row, and a permanently-visible red Delete button — ~166px of
          chrome before the filters even started. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="text-2xl font-semibold text-ink">{projectResult.project.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ViewSwitcher projectId={projectId} view={view} search={searchString} />
          <ProjectMenu projectId={projectId} projectName={projectResult.project.name} canManage={canManage} />
        </div>
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
