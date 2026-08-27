/**
 * One-time seed script: creates a handful of demo projects, board sections,
 * tasks, subtasks, and comments so the Tasks pillar has real content on
 * first login. Run with: npm run seed:tasks
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — this key bypasses RLS
 * and must never be shipped to the browser. Safe to re-run: skips any
 * project whose name already exists.
 *
 * Note: PostgREST's bulk insert sends an explicit NULL (not the column
 * default) for any key omitted on a row when other rows in the same
 * insert() call include that key — so every task/subtask row below sets
 * `done` and `position` explicitly rather than relying on their DB
 * defaults.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SECTION_NAMES = ["To do", "In progress", "Done"];

interface Employee {
  id: string;
  name: string;
}

interface ProjectSeed {
  name: string;
  color: string;
  tasks: {
    title: string;
    section: number; // index into SECTION_NAMES
    assignee?: number; // index into the fetched employees array
    priority: "low" | "medium" | "high";
    dueDate?: string;
    done?: boolean;
    subtasks?: string[];
    comment?: string;
  }[];
}

function projectSeeds(employeeCount: number): ProjectSeed[] {
  const a = (i: number) => i % employeeCount;
  return [
    {
      name: "Product Launch",
      color: "#0ea5e9",
      tasks: [
        { title: "Finalize pricing page copy", section: 0, assignee: a(0), priority: "high", dueDate: "2026-08-20" },
        {
          title: "QA the checkout flow",
          section: 0,
          assignee: a(1),
          priority: "medium",
          subtasks: ["Test card payment", "Test failed payment", "Test refund"],
        },
        {
          title: "Write launch announcement",
          section: 1,
          assignee: a(2),
          priority: "high",
          dueDate: "2026-08-18",
          comment: "Draft is in the shared doc, please review by Friday.",
        },
        { title: "Brief customer support team", section: 2, assignee: a(3), priority: "low", done: true },
      ],
    },
    {
      name: "Design Sprint",
      color: "#7c3aed",
      tasks: [
        { title: "User interviews synthesis", section: 0, assignee: a(4), priority: "medium" },
        {
          title: "Component library audit",
          section: 1,
          assignee: a(5),
          priority: "low",
          subtasks: ["Buttons", "Form inputs", "Cards"],
        },
        {
          title: "Prototype v2 navigation",
          section: 1,
          assignee: a(0),
          priority: "high",
          dueDate: "2026-08-22",
          comment: "Figma link shared in the design channel.",
        },
        { title: "Present findings to stakeholders", section: 2, assignee: a(6), priority: "medium", done: true },
      ],
    },
    {
      name: "Support Backlog",
      color: "#0d9488",
      tasks: [
        { title: "Investigate export CSV bug", section: 0, assignee: a(7), priority: "high", dueDate: "2026-08-16" },
        { title: "Update FAQ for new billing flow", section: 0, priority: "low" },
        {
          title: "Triage weekend ticket backlog",
          section: 1,
          assignee: a(8),
          priority: "medium",
          subtasks: ["Sort by severity", "Assign owners"],
        },
      ],
    },
  ];
}

async function seed() {
  const { data: employeesData, error: employeesError } = await supabase
    .from("employees")
    .select("id, name")
    .order("name")
    .returns<Employee[]>();

  if (employeesError || !employeesData || employeesData.length === 0) {
    console.error("Failed to fetch employees:", employeesError?.message ?? "no employees found");
    process.exit(1);
  }
  const employees = employeesData;

  const currentEmployeeId = employees[0]?.id;
  if (!currentEmployeeId) {
    console.error("No employees to attribute created_by/author_id to.");
    process.exit(1);
  }

  for (const seedProject of projectSeeds(employees.length)) {
    const { data: existing } = await supabase.from("projects").select("id").eq("name", seedProject.name).maybeSingle();
    if (existing) {
      console.log(`- ${seedProject.name}: already exists, skipping`);
      continue;
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({ name: seedProject.name, color: seedProject.color })
      .select("id")
      .single();
    if (projectError || !project) {
      console.error(`✗ ${seedProject.name}: ${projectError?.message}`);
      continue;
    }

    const { data: sections, error: sectionError } = await supabase
      .from("board_sections")
      .insert(SECTION_NAMES.map((name, position) => ({ project_id: project.id, name, position })))
      .select("id, name");
    if (sectionError || !sections) {
      console.error(`✗ ${seedProject.name}: sections failed: ${sectionError?.message}`);
      continue;
    }

    const taskRows = seedProject.tasks.map((t, position) => ({
      project_id: project.id,
      section_id: sections[t.section].id,
      title: t.title,
      assignee_id: t.assignee !== undefined ? employees[t.assignee].id : null,
      created_by: currentEmployeeId,
      priority: t.priority,
      due_date: t.dueDate ?? null,
      done: t.done ?? false,
      position,
    }));

    const { data: insertedTasks, error: taskError } = await supabase.from("tasks").insert(taskRows).select("id");
    if (taskError || !insertedTasks) {
      console.error(`✗ ${seedProject.name}: tasks failed: ${taskError?.message}`);
      continue;
    }

    for (let i = 0; i < seedProject.tasks.length; i++) {
      const t = seedProject.tasks[i];
      const taskId = insertedTasks[i].id;

      if (t.subtasks && t.subtasks.length > 0) {
        const { error } = await supabase
          .from("subtasks")
          .insert(t.subtasks.map((title, position) => ({ task_id: taskId, title, done: false, position })));
        if (error) console.error(`  ✗ subtasks for "${t.title}": ${error.message}`);
      }

      if (t.comment) {
        const { error } = await supabase
          .from("task_comments")
          .insert({ task_id: taskId, author_id: currentEmployeeId, body: t.comment });
        if (error) console.error(`  ✗ comment for "${t.title}": ${error.message}`);
      }
    }

    console.log(`✓ ${seedProject.name}: ${sections.length} sections, ${insertedTasks.length} tasks`);
  }

  console.log("\nDone.");
}

seed();
