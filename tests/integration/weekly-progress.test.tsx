/**
 * End-to-end-ish integration test proving weekly progress recalculates
 * automatically (through the real hooks + real API route handlers + real
 * database) on create and on status change, not just via the pure
 * calcWeeklyProgress function in isolation.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useCreateTodo, useTodosQuery, useUpdateTodoStatus } from "@/hooks/useTodos";
import { calcWeeklyProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import type { TodosFilter } from "@/lib/types";
import { renderWithQueryClient, stubFetchToRouteHandlers } from "../helpers/test-utils";
import { authCookieFor, createTestUser } from "../helpers/auth";

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
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({});
    const user = await createTestUser();
    stubFetchToRouteHandlers(await authCookieFor(user.id));
  });

  it("starts at 0% with no todos, then updates as todos are created and completed", async () => {
    renderWithQueryClient(<Harness />);

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
