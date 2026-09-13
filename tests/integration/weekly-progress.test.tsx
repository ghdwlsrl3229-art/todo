/**
 * End-to-end-ish integration test proving weekly progress recalculates
 * automatically (through the real hooks + real API route handlers + real
 * database) on create and on status change, not just via the pure
 * calcWeeklyProgress function in isolation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GET, POST } from "@/app/api/todos/route";
import { PATCH } from "@/app/api/todos/[id]/route";
import { useCreateTodo, useTodosQuery, useUpdateTodoStatus } from "@/hooks/useTodos";
import { calcWeeklyProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import type { TodosFilter } from "@/lib/types";

// Route fetch() calls straight to the real Next.js route handlers, so this
// test exercises the same code path the browser would use.
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : (input as Request).url;
    const url = new URL(rawUrl, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const nextReq = new NextRequest(new Request(url.toString(), init));

    if (url.pathname === "/api/todos" && method === "GET") return GET(nextReq);
    if (url.pathname === "/api/todos" && method === "POST") return POST(nextReq);

    const idMatch = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (idMatch && method === "PATCH") return PATCH(nextReq, { params: { id: idMatch[1] } });

    throw new Error(`unhandled fetch in test: ${method} ${url.pathname}`);
  })
);

const filter: TodosFilter = { periodType: "WEEKLY", targetDate: "2026-09-14" };

function Harness() {
  const { data } = useTodosQuery(filter);
  const create = useCreateTodo();
  const updateStatus = useUpdateTodoStatus(filter);

  return (
    <div>
      <div data-testid="progress">{data ? calcWeeklyProgress(data) : "loading"}</div>
      <div data-testid="count">{data?.length ?? 0}</div>
      <button
        onClick={() =>
          create.mutate({ title: `Item ${(data?.length ?? 0) + 1}`, periodType: "WEEKLY", targetDate: filter.targetDate! })
        }
      >
        create
      </button>
      {data?.map((t) => (
        <button key={t.id} data-testid={`done-${t.id}`} onClick={() => updateStatus.mutate({ id: t.id, status: "DONE" })}>
          mark done: {t.title}
        </button>
      ))}
    </div>
  );
}

describe("weekly progress recalculation (integration)", () => {
  beforeEach(async () => {
    await prisma.todo.deleteMany({});
  });

  it("starts at 0% with no todos, then updates as todos are created and completed", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("progress").textContent).toBe("0"));

    fireEvent.click(screen.getByText("create"));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(screen.getByTestId("progress").textContent).toBe("0");

    fireEvent.click(screen.getByText("create"));
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
    expect(screen.getByTestId("progress").textContent).toBe("0");

    const firstDoneButton = screen.getAllByText(/mark done/)[0];
    fireEvent.click(firstDoneButton);

    await waitFor(() => expect(screen.getByTestId("progress").textContent).toBe("50"));
  });
});
