"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@/components/ui/Menu";
import { deleteProject } from "@/app/(app)/tasks/actions";

/**
 * Project-level actions, behind an overflow trigger.
 *
 * Replaces DeleteProjectButton, which was a permanently-visible red button
 * sitting beside the project title — a one-click path to destroying every
 * task, subtask and comment in a project, on the screen you visit most.
 * Same confirm text, same action; only the affordance changed.
 */
export function ProjectMenu({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm(`Delete "${projectName}"? This removes every task, subtask, and comment in it.`)) return;
    startTransition(async () => {
      await deleteProject(projectId);
      router.push("/tasks");
    });
  }

  return (
    <Menu
      ariaLabel={`Actions for ${projectName}`}
      align="right"
      trigger={
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      }
      items={[
        {
          key: "delete",
          label: isPending ? "Deleting…" : "Delete project",
          danger: true,
          disabled: isPending,
          onSelect: handleDelete,
        },
      ]}
    />
  );
}
