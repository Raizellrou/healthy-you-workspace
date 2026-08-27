import { Tabs } from "@/components/ui/Tabs";

const VIEWS = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "timeline", label: "Timeline" },
] as const;

export type ViewKey = (typeof VIEWS)[number]["key"];
export const VIEW_KEYS: readonly string[] = VIEWS.map((v) => v.key);

/** Switches between the four lenses on one dataset, carrying the current
 *  filters (`search`, the querystring including its leading "?") along —
 *  changing view never resets what you were looking at. */
export function ViewSwitcher({ projectId, view, search }: { projectId: string; view: string; search: string }) {
  return (
    <Tabs
      ariaLabel="View"
      active={view}
      items={VIEWS.map((v) => ({
        key: v.key,
        label: v.label,
        href: `/tasks/project/${projectId}/${v.key}${search}`,
      }))}
    />
  );
}
