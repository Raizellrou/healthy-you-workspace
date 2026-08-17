"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteProject } from "@/app/(app)/tasks/actions";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
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
    <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={isPending}>
      {isPending ? "Deleting…" : "Delete project"}
    </Button>
  );
}
