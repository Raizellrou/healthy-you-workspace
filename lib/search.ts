import { sectionsFor, INBOX_ITEMS, SETTINGS_ITEMS } from "@/components/shell/navSections";
import type { AppRole } from "@/types/person";
import type { Employee } from "@/types/employee";
import type { Project, Task } from "@/types/task";
import type { IconName } from "@/components/icons/Icon";

/**
 * Pure index + scorer for the command palette (P9). No dependency, hand-
 * rolled rather than a library — the dataset is ~24 employees, a handful of
 * projects, and one person's own tasks, small enough that a library buys
 * nothing but a node_modules entry.
 */

export type SearchItemType = "page" | "person" | "project" | "task";

export interface SearchItem {
  type: SearchItemType;
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  icon: IconName;
}

/** Nav destinations reuse navSections.ts's own role filtering — the palette
 *  can never show a page the sidebar itself would hide from this role. */
function buildPageItems(role: AppRole): SearchItem[] {
  const items: SearchItem[] = [];
  for (const section of sectionsFor(role)) {
    for (const item of section.items) {
      items.push({ type: "page", id: item.href, label: item.label, href: item.href, icon: item.icon });
    }
  }
  for (const item of INBOX_ITEMS) {
    items.push({ type: "page", id: item.href, label: item.label, href: item.href, icon: item.icon });
  }
  for (const item of SETTINGS_ITEMS) {
    items.push({ type: "page", id: item.href, label: item.label, href: item.href, icon: item.icon });
  }
  return items;
}

export function buildSearchIndex({
  employees,
  projects,
  myTasks,
  role,
  defaultTaskView,
}: {
  employees: Employee[];
  projects: Project[];
  myTasks: Task[];
  role: AppRole;
  defaultTaskView: string;
}): SearchItem[] {
  const people: SearchItem[] = employees.map((e) => ({
    type: "person",
    id: e.id,
    label: e.name,
    // Directory's own search box is local useState, not URL-synced (see
    // DirectoryClient.tsx), so a result can only land on the page, not a
    // pre-filtered view — the sublabel is what lets the person spot
    // themselves once there.
    sublabel: `${e.role} · ${e.team}`,
    href: "/directory",
    icon: "users",
  }));

  const projectItems: SearchItem[] = projects.map((p) => ({
    type: "project",
    id: p.id,
    label: p.name,
    href: `/tasks/project/${p.id}/${defaultTaskView}`,
    icon: "list",
  }));

  const taskItems: SearchItem[] = myTasks.map((t) => ({
    type: "task",
    id: t.id,
    label: t.title,
    sublabel: t.project_name ?? undefined,
    href: `/tasks/${t.id}`,
    icon: "check",
  }));

  return [...buildPageItems(role), ...people, ...projectItems, ...taskItems];
}

/** Case-insensitive: exact-prefix and word-boundary-prefix score highest,
 *  a plain substring scores by how early it appears, and a scattered
 *  subsequence match (every query char present, in order, not necessarily
 *  contiguous) is the low-confidence fallback. Returns null for no match. */
export function scoreMatch(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;

  if (t === q) return 100;
  if (t.startsWith(q)) return 90 - Math.min(20, t.length - q.length);

  const wordBoundaryIndex = t.indexOf(` ${q}`);
  if (wordBoundaryIndex !== -1) return 75 - Math.min(15, wordBoundaryIndex);

  const substringIndex = t.indexOf(q);
  if (substringIndex !== -1) return 50 - Math.min(20, substringIndex);

  // Subsequence: every char of q must appear in t, in order.
  let ti = 0;
  let spread = 0;
  let lastMatch = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return null;
    if (lastMatch !== -1) spread += found - lastMatch - 1;
    lastMatch = found;
    ti = found + 1;
  }
  return Math.max(1, 25 - spread);
}

function bestItemScore(query: string, item: SearchItem): number | null {
  const labelScore = scoreMatch(query, item.label);
  const subScore = item.sublabel ? scoreMatch(query, item.sublabel) : null;
  // A sublabel match (e.g. matching someone's team, not their name) is real
  // but shouldn't outrank an actual label match — discount it.
  const candidates = [labelScore, subScore !== null ? subScore - 10 : null].filter(
    (s): s is number => s !== null
  );
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

export function searchIndex(index: SearchItem[], query: string, limit = 8): SearchItem[] {
  if (!query.trim()) return [];
  return index
    .map((item) => ({ item, score: bestItemScore(query, item) }))
    .filter((r): r is { item: SearchItem; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}
