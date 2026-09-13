import type { PeriodType, Status, Todo, TodosFilter } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function buildQuery(filter: TodosFilter): string {
  const params = new URLSearchParams();
  if (filter.periodType) params.set("periodType", filter.periodType);
  if (filter.status) params.set("status", filter.status);
  if (filter.targetDate) params.set("targetDate", filter.targetDate);
  if (filter.parentId !== undefined) {
    params.set("parentId", filter.parentId === null ? "null" : filter.parentId);
  }
  return params.toString();
}

export function fetchTodos(filter: TodosFilter): Promise<Todo[]> {
  const qs = buildQuery(filter);
  return fetch(`/api/todos${qs ? `?${qs}` : ""}`).then((res) => handle<Todo[]>(res));
}

export interface CreateTodoInput {
  title: string;
  periodType: PeriodType;
  targetDate: string;
  parentId?: string | null;
}

export function createTodo(input: CreateTodoInput): Promise<Todo> {
  return fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handle<Todo>(res));
}

export interface UpdateTodoInput {
  title?: string;
  periodType?: PeriodType;
  targetDate?: string;
  status?: Status;
  parentId?: string | null;
}

export function updateTodo(id: string, input: UpdateTodoInput): Promise<Todo> {
  return fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((res) => handle<Todo>(res));
}

export function deleteTodo(id: string): Promise<void> {
  return fetch(`/api/todos/${id}`, { method: "DELETE" }).then((res) => handle<void>(res));
}

export function reorderTodos(status: Status, orderedIds: string[]): Promise<{ ok: true }> {
  return fetch("/api/todos/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, orderedIds }),
  }).then((res) => handle<{ ok: true }>(res));
}
