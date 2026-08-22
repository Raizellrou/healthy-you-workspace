"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Icon } from "@/components/icons/Icon";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskComposer } from "@/components/tasks/TaskComposer";
import { renameSection, deleteSection } from "@/app/(app)/tasks/actions";
import type { BoardSection, Label, Task } from "@/types/task";
import type { Employee } from "@/types/employee";

export function BoardColumn({
  section,
  allSections,
  projectId,
  tasks,
  employees,
  labels,
}: {
  section: BoardSection;
  allSections: BoardSection[];
  projectId: string;
  tasks: Task[];
  employees: Employee[];
  labels: Label[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  const [name, setName] = useState(section.name);
  const [composerOpen, setComposerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRename() {
    if (name.trim() && name !== section.name) {
      startTransition(async () => {
        await renameSection(section.id, projectId, name.trim());
        router.refresh();
      });
    }
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSection(section.id, projectId);
      router.refresh();
    });
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-2 p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleRename}
          disabled={isPending}
          className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-ink outline-none disabled:opacity-60"
        />
        <span className="shrink-0 text-xs text-ink-mute">{tasks.length}</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={`Delete section ${section.name}`}
          className="shrink-0 text-ink-mute hover:text-risk-critical disabled:opacity-60"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-16 flex-1 flex-col gap-2 rounded-lg transition-colors ${
          isOver ? "bg-brand-soft/40" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="shrink-0 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-ink-mute transition-colors hover:bg-surface hover:text-ink"
        >
          + Add task
        </button>
      </div>

      <TaskComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        projectId={projectId}
        sections={allSections}
        defaultSectionId={section.id}
        employees={employees}
        labels={labels}
      />
    </div>
  );
}
