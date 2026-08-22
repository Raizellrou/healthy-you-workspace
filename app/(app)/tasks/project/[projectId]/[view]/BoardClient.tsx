"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import { BoardColumn } from "@/components/tasks/BoardColumn";
import { moveTask, createSection } from "@/app/(app)/tasks/actions";
import type { BoardSection, Label, Task } from "@/types/task";
import type { Employee } from "@/types/employee";

function buildColumns(sections: BoardSection[], tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};
  for (const s of sections) map[s.id] = [];
  for (const t of tasks) {
    const key = t.section_id && map[t.section_id] ? t.section_id : sections[0]?.id;
    if (key) map[key].push(t);
  }
  for (const key of Object.keys(map)) map[key].sort((a, b) => a.position - b.position);
  return map;
}

export function BoardClient({
  projectId,
  sections,
  tasks,
  employees,
  labels,
}: {
  projectId: string;
  sections: BoardSection[];
  tasks: Task[];
  employees: Employee[];
  labels: Label[];
}) {
  const [columns, setColumns] = useState<Record<string, Task[]>>(() => buildColumns(sections, tasks));
  const [newSectionName, setNewSectionName] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Re-sync whenever the server refetches sections/tasks (after a section
  // add/rename/delete, or a moveTask revalidation, or a filter change in
  // the URL). These props only change when Next.js actually re-fetches
  // server data, not on every client render, so this can't clobber
  // in-flight drag state. Adjusting state directly during render (guarded
  // by a prev-value comparison) rather than in a useEffect avoids an extra
  // render pass — the pattern React's docs recommend for "sync state to a
  // prop change."
  const [prevSections, setPrevSections] = useState(sections);
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (sections !== prevSections || tasks !== prevTasks) {
    setPrevSections(sections);
    setPrevTasks(tasks);
    setColumns(buildColumns(sections, tasks));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function findColumnOf(taskId: string): string | undefined {
    return Object.keys(columns).find((sectionId) => columns[sectionId].some((t) => t.id === taskId));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const sourceSectionId = findColumnOf(activeId);
    if (!sourceSectionId) return;

    // `over.id` is either another task's id (drop next to it) or a section
    // id directly (drop into an empty or short column).
    const overId = over.id as string;
    const targetSectionId = columns[overId] ? overId : findColumnOf(overId);
    if (!targetSectionId) return;

    const sourceTasks = [...columns[sourceSectionId]];
    const activeIndex = sourceTasks.findIndex((t) => t.id === activeId);
    if (activeIndex === -1) return;
    const [moved] = sourceTasks.splice(activeIndex, 1);

    const targetTasks = sourceSectionId === targetSectionId ? sourceTasks : [...columns[targetSectionId]];
    const overIndex = targetTasks.findIndex((t) => t.id === overId);
    const insertAt = overIndex >= 0 ? overIndex : targetTasks.length;
    targetTasks.splice(insertAt, 0, { ...moved, section_id: targetSectionId });

    // setColumns stays a pure state update; the server action is a side
    // effect fired after, not from inside the updater — calling it there
    // triggers React's "Cannot update a component while rendering a
    // different component" error via revalidatePath's router update.
    setColumns((prev) => ({ ...prev, [sourceSectionId]: sourceTasks, [targetSectionId]: targetTasks }));

    void moveTask(
      activeId,
      projectId,
      targetSectionId,
      targetTasks.map((t) => t.id)
    );
  }

  function handleAddSection() {
    const name = newSectionName.trim();
    if (!name) return;
    setNewSectionName("");
    startTransition(async () => {
      await createSection(projectId, name);
      router.refresh();
    });
  }

  return (
    // Explicit `id`: dnd-kit's default id generator isn't deterministic
    // between the server render and the client hydration pass, which
    // produces an aria-describedby hydration mismatch without this.
    <DndContext
      id={`board-${projectId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sections.map((section) => (
          <BoardColumn
            key={section.id}
            section={section}
            allSections={sections}
            projectId={projectId}
            tasks={columns[section.id] ?? []}
            employees={employees}
            labels={labels}
          />
        ))}
        <div className="w-72 shrink-0 rounded-xl border border-dashed border-line p-3">
          <input
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSection();
              }
            }}
            placeholder="+ Add section"
            disabled={isPending}
            className="w-full border-none bg-transparent text-sm font-medium text-ink-soft outline-none placeholder:text-ink-mute disabled:opacity-60"
          />
        </div>
      </div>
    </DndContext>
  );
}
