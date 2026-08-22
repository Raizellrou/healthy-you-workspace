"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createProject } from "./actions";
import type { Project } from "@/types/task";

// A project's canonical URL used to always be its Board view. P7's
// ui_preferences.default_task_view makes that the person's own preferred
// lens instead — pathname.startsWith still covers every view under a
// project (list/calendar/timeline too), so the tab reads "active" no
// matter which lens you're actually on.
function projectHref(projectId: string, defaultView: string): string {
  return `/tasks/project/${projectId}/${defaultView}`;
}

const PROJECT_COLORS = ["#0ea5e9", "#7c3aed", "#0d9488", "#c026d3", "#4338ca"];

function TabLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "border-brand text-ink" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export function TasksNav({ projects, defaultView = "board" }: { projects: Project[]; defaultView?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    startTransition(async () => {
      const result = await createProject(trimmed, color);
      if (result.ok && result.id) {
        setName("");
        setCreating(false);
        router.push(projectHref(result.id, defaultView));
      }
    });
  }

  return (
    <div className="border-b border-line bg-surface px-6">
      <nav aria-label="Tasks" className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto">
        <TabLink href="/tasks" active={pathname === "/tasks"}>
          My Tasks
        </TabLink>
        {projects.map((p) => (
          <TabLink
            key={p.id}
            href={projectHref(p.id, defaultView)}
            active={pathname.startsWith(`/tasks/project/${p.id}`)}
          >
            {p.name}
          </TabLink>
        ))}
        <TabLink href="/tasks/workload" active={pathname === "/tasks/workload"}>
          Workload
        </TabLink>

        {creating ? (
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
            className="ml-1 w-40 shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none disabled:opacity-60"
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="ml-1 shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
          >
            + New project
          </button>
        )}
      </nav>
    </div>
  );
}
