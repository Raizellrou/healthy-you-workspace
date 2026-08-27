"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/(app)/tasks/actions";

const PROJECT_COLORS = ["#0ea5e9", "#7c3aed", "#0d9488", "#c026d3", "#4338ca"];

/**
 * The "+ New project" affordance at the foot of the nav panel's project list.
 * Lifted out of the retired TasksNav tab strip, which is where creating a
 * project used to live — it belongs beside the list of projects, not in a
 * horizontally-scrolling row above the page content.
 */
export function NewProjectItem({
  projectCount,
  defaultView,
}: {
  projectCount: number;
  defaultView: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const color = PROJECT_COLORS[projectCount % PROJECT_COLORS.length];
    startTransition(async () => {
      const result = await createProject(trimmed, color);
      if (result.ok && result.id) {
        setName("");
        setCreating(false);
        router.push(`/tasks/project/${result.id}/${defaultView}`);
      }
    });
  }

  if (creating) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (!name.trim()) setCreating(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          }
          if (e.key === "Escape") {
            setCreating(false);
            setName("");
          }
        }}
        placeholder="Project name…"
        disabled={isPending}
        aria-label="New project name"
        className="mx-1 w-[calc(100%-0.5rem)] rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand disabled:opacity-60"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
    >
      + New project
    </button>
  );
}
