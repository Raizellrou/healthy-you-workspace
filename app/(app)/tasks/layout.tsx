/**
 * Deliberately a pass-through.
 *
 * This used to render a "Tasks · Productivity" eyebrow and the TasksNav
 * project tab strip. Both are gone: the nav rail and panel already say
 * where you are, and projects are panel destinations now (see
 * components/shell/NavPanel.tsx), which removes the horizontal-scroll
 * failure the tab strip hit past four or five projects.
 *
 * Kept as a file rather than deleted so the /tasks segment still has a
 * layout boundary to hang future task-wide UI on.
 */
export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
