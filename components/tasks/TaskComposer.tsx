"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { LabelPicker } from "@/components/tasks/LabelPicker";
import { EstimateField } from "@/components/tasks/EstimateField";
import { createTask } from "@/app/(app)/tasks/actions";
import type { BoardSection, Label as TaskLabel, Priority } from "@/types/task";
import type { Employee } from "@/types/employee";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

/**
 * There was no way to create a task anywhere in the app before P3 — every
 * task came from scripts/seed-tasks.ts. This is that missing first click.
 */
export function TaskComposer({
  open,
  onClose,
  projectId,
  sections,
  defaultSectionId,
  employees,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  sections: BoardSection[];
  defaultSectionId: string | null;
  employees: Employee[];
  labels: TaskLabel[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState(defaultSectionId ?? sections[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimateHours, setEstimateHours] = useState<number | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setSectionId(defaultSectionId ?? sections[0]?.id ?? "");
    setAssigneeId("");
    setPriority("medium");
    setDueDate("");
    setEstimateHours(null);
    setLabelIds([]);
    setError(null);
  }

  function handleClose() {
    if (isPending) return;
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        projectId,
        sectionId: sectionId || null,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || null,
        priority,
        dueDate: dueDate || null,
        estimateHours,
        labelIds,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to create task.");
        return;
      }
      reset();
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New task"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !title.trim()}>
            {isPending ? "Creating…" : "Create task"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical">
            {error}
          </div>
        )}

        <Field label="Title" required>
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="What needs doing?"
              disabled={isPending}
            />
          )}
        </Field>

        <Field label="Description">
          {(p) => (
            <Textarea
              {...p}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Add more detail…"
              disabled={isPending}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Section">
            {(p) => (
              <Select
                {...p}
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                options={sections.map((s) => ({ value: s.id, label: s.name }))}
                disabled={isPending}
              />
            )}
          </Field>
          <Field label="Assignee">
            {(p) => (
              <Select
                {...p}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
                placeholder="Unassigned"
                disabled={isPending}
              />
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Priority">
            {(p) => (
              <Select
                {...p}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                options={PRIORITIES.map((pr) => ({ value: pr, label: pr[0].toUpperCase() + pr.slice(1) }))}
                disabled={isPending}
              />
            )}
          </Field>
          <Field label="Due date">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isPending}
              />
            )}
          </Field>
          <Field label="Estimate (h)">
            {() => <EstimateField value={estimateHours} onChange={setEstimateHours} disabled={isPending} />}
          </Field>
        </div>

        {labels.length > 0 && (
          <Field label="Labels">
            {() => <LabelPicker labels={labels} selectedIds={labelIds} onChange={setLabelIds} disabled={isPending} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}
