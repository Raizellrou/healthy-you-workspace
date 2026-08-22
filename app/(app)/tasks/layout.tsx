import { getProjects, getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getUiPreferences } from "@/lib/supabase/preferences";
import { TasksNav } from "./TasksNav";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  const [projects, employeeId] = await Promise.all([getProjects(), getCurrentEmployeeId()]);
  const defaultView = employeeId ? (await getUiPreferences(employeeId)).defaultTaskView : "board";
  return (
    <div>
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 pt-6">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#4E3378" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#4E3378" }}>
          Tasks · Productivity
        </span>
      </div>
      <TasksNav projects={projects} defaultView={defaultView} />
      {children}
    </div>
  );
}
