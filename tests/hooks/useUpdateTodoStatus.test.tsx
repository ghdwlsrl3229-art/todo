import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { todosQueryKey, useUpdateTodoStatus } from "@/hooks/useTodos";
import type { Todo } from "@/lib/types";

const filter = { periodType: "DAILY" as const, targetDate: "2026-09-14" };

const sampleTodos: Todo[] = [
  {
    id: "1",
    title: "A",
    status: "TODO",
    periodType: "DAILY",
    targetDate: "2026-09-14T00:00:00.000Z",
    order: 0,
    parentId: null,
    completedAt: null,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  },
];

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useUpdateTodoStatus (drag-and-drop optimistic update)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(todosQueryKey(filter), sampleTodos);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the new status immediately, then rolls back when the save fails", async () => {
    // Use a manually-controlled promise so the intermediate optimistic
    // state can be observed deterministically before the request settles
    // (a mock that resolves/rejects immediately races with onMutate).
    let rejectFetch!: (reason: unknown) => void;
    const pending = new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    });
    vi.spyOn(global, "fetch").mockReturnValue(pending);

    const { result } = renderHook(() => useUpdateTodoStatus(filter), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: "1", status: "DOING" });
    });

    // optimistic update applied synchronously in onMutate, before the
    // (still-pending) network request resolves
    await waitFor(() => {
      const cached = queryClient.getQueryData<Todo[]>(todosQueryKey(filter));
      expect(cached?.[0].status).toBe("DOING");
    });

    act(() => {
      rejectFetch(new Error("network error"));
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const cached = queryClient.getQueryData<Todo[]>(todosQueryKey(filter));
    expect(cached?.[0].status).toBe("TODO");
  });

  it("keeps the new status when the save succeeds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...sampleTodos[0], status: "DOING" }),
    } as Response);

    const { result } = renderHook(() => useUpdateTodoStatus(filter), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: "1", status: "DOING" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<Todo[]>(todosQueryKey(filter));
    expect(cached?.[0].status).toBe("DOING");
  });
});
