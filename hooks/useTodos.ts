import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import type { Status, Todo, TodosFilter } from "@/lib/types";

export function todosQueryKey(filter: TodosFilter) {
  return ["todos", filter] as const;
}

export function useTodosQuery(filter: TodosFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: todosQueryKey(filter),
    queryFn: () => api.fetchTodos(filter),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTodo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateTodoInput }) =>
      api.updateTodo(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

/**
 * Status-change mutation used by drag-and-drop. Optimistically updates the
 * cached list for `filter` and rolls back to the previous snapshot if the
 * PATCH request fails.
 */
export function useUpdateTodoStatus(filter: TodosFilter) {
  const qc = useQueryClient();
  const key = todosQueryKey(filter);

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      api.updateTodo(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Todo[]>(key);
      qc.setQueryData<Todo[]>(key, (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) ?? old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Reorder mutation for same-column drag reordering. Optimistically applies
 * the new order locally and rolls back on failure.
 */
export function useReorderTodos(filter: TodosFilter) {
  const qc = useQueryClient();
  const key = todosQueryKey(filter);

  return useMutation({
    mutationFn: ({ status, orderedIds }: { status: Status; orderedIds: string[] }) =>
      api.reorderTodos(status, orderedIds),
    onMutate: async ({ status, orderedIds }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Todo[]>(key);
      qc.setQueryData<Todo[]>(key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((t) => [t.id, t]));
        const reordered = orderedIds
          .map((id, index) => {
            const t = byId.get(id);
            return t ? { ...t, status, order: index } : undefined;
          })
          .filter((t): t is Todo => Boolean(t));
        const others = old.filter((t) => !orderedIds.includes(t.id));
        return [...others, ...reordered];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
