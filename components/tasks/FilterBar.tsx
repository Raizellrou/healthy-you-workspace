"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { saveTaskView, deleteTaskView } from "@/app/(app)/tasks/actions";
import type { Employee } from "@/types/employee";
import type { Label, Priority } from "@/types/task";
import type { TaskViewSummary } from "@/lib/supabase/tasks";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

/**
 * Filter state lives in the URL's searchParams, not React state — every
 * change here is a `router.push` with an updated querystring, which is
 * what makes a filtered view shareable (copy the URL) and a "saved view"
 * (task_views, 0013) just a name pointing at one of these querystrings.
 */
export function FilterBar({
  projectId,
  view,
  employees,
  labels,
  savedViews,
  currentEmployeeId,
}: {
  projectId: string;
  view: string;
  employees: Employee[];
  labels: Label[];
  savedViews: TaskViewSummary[];
  currentEmployeeId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const hasFilters = searchParams.toString().length > 0;

  function handleSaveView() {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    startTransition(async () => {
      await saveTaskView({
        projectId,
        name: name.trim(),
        layout: view,
        filters: Object.fromEntries(searchParams.entries()),
      });
      router.refresh();
    });
  }

  function handleLoadView(v: TaskViewSummary) {
    const params = new URLSearchParams(v.filters);
    router.push(`/tasks/project/${projectId}/${v.layout}?${params.toString()}`);
  }

  function handleDeleteView(v: TaskViewSummary) {
    startTransition(async () => {
      await deleteTaskView(v.id, projectId, v.layout);
      router.refresh();
    });
  }

  return (
    <div className="mb-4 flex flex-col gap-2">
      {/* Each control is sized by a wrapper, never by a `w-*` on the control
          itself: CONTROL_CLASSES leads with `w-full`, and Tailwind emits
          `w-full` after the numeric widths, so a `className="w-48"` here
          loses the cascade (class-attribute order is irrelevant to CSS) and
          every control rendered at full container width — which is what
          collapsed this single row into three stacked ones. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParam("q", q);
            }}
            onBlur={() => updateParam("q", q)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </div>
        <div className="w-36">
          <Select
            value={searchParams.get("assignee") ?? ""}
            onChange={(e) => updateParam("assignee", e.target.value)}
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
            placeholder="Anyone"
            aria-label="Filter by assignee"
          />
        </div>
        <div className="w-36">
          <Select
            value={searchParams.get("priority") ?? ""}
            onChange={(e) => updateParam("priority", e.target.value)}
            options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            placeholder="Any priority"
            aria-label="Filter by priority"
          />
        </div>
        {labels.length > 0 && (
          <div className="w-36">
            <Select
              value={searchParams.get("label") ?? ""}
              onChange={(e) => updateParam("label", e.target.value)}
              options={labels.map((l) => ({ value: l.id, label: l.name }))}
              placeholder="Any label"
              aria-label="Filter by label"
            />
          </div>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-xs text-ink-mute underline hover:text-ink"
          >
            Clear filters
          </button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleSaveView}
          disabled={isPending || !hasFilters}
          className="ml-auto"
        >
          Save view
        </Button>
      </div>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">Saved</span>
          {savedViews.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft"
            >
              <button type="button" onClick={() => handleLoadView(v)} className="hover:text-ink">
                {v.name}
              </button>
              {v.ownerId === currentEmployeeId ? (
                <button
                  type="button"
                  onClick={() => handleDeleteView(v)}
                  aria-label={`Delete saved view ${v.name}`}
                  className="text-ink-mute hover:text-risk-critical"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
