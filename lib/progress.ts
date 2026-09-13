import type { Status } from "./types";

/**
 * Weekly progress = done / total * 100, rounded to the nearest integer.
 * Returns 0 when there are no todos in the period (avoids NaN from 0/0).
 */
export function calcWeeklyProgress(todos: { status: Status }[]): number {
  if (todos.length === 0) return 0;
  const done = todos.filter((t) => t.status === "DONE").length;
  return Math.round((done / todos.length) * 100);
}

/**
 * Yearly progress is derived from the completion of linked weekly todos
 * (children of the yearly todo), not from the yearly todo's own status.
 * Returns 0 when there are no linked weekly todos.
 */
export function calcYearlyProgress(linkedWeeklyTodos: { status: Status }[]): number {
  return calcWeeklyProgress(linkedWeeklyTodos);
}
