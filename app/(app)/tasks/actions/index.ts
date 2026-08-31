/**
 * Barrel re-export so `@/app/(app)/tasks/actions` keeps resolving after the
 * former single 849-line actions.ts was split by domain (tasks, subtasks,
 * projects, sections, comments, views) — no consumer import needs to change.
 */
export * from "./tasks";
export * from "./subtasks";
export * from "./projects";
export * from "./sections";
export * from "./comments";
export * from "./views";
