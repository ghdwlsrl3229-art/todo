/**
 * Regression test for a bug the architect review caught: CreateTodoForm
 * sends `parentId: null` when no parent is selected, which the create
 * schema rejected (only `undefined` was accepted), so no todo could ever
 * be created from the UI unless a parent was explicitly picked — and
 * YEARLY todos, which have no parent picker at all, could never be
 * created. This renders the real component against the real route
 * handlers (not a mock), the same way tests/integration/weekly-progress
 * does, so it exercises the actual payload CreateTodoForm builds.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { prisma } from "@/lib/prisma";
import { CreateTodoForm } from "@/components/CreateTodoForm";
import { renderWithQueryClient as renderWithClient, stubFetchToRouteHandlers } from "../helpers/test-utils";

stubFetchToRouteHandlers();

describe("CreateTodoForm (component, against real route handlers)", () => {
  beforeEach(async () => {
    await prisma.todo.deleteMany({});
  });

  it("creates a todo with no parent selected (DAILY, has a parent picker)", async () => {
    renderWithClient(<CreateTodoForm periodType="DAILY" referenceDate="2026-09-14" />);

    fireEvent.change(screen.getByPlaceholderText("할 일 제목"), { target: { value: "우유 사기" } });
    fireEvent.click(screen.getByText("추가"));

    await waitFor(async () => {
      const list = await prisma.todo.findMany({});
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("우유 사기");
      expect(list[0].parentId).toBeNull();
    });

    expect(screen.queryByText(/validation failed|parent not found/)).not.toBeInTheDocument();
  });

  it("creates a YEARLY todo, which has no parent picker at all", async () => {
    renderWithClient(<CreateTodoForm periodType="YEARLY" referenceDate="2026-01-01" />);

    // YEARLY has no parentPeriodTypeFor mapping, so no <select> renders.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("할 일 제목"), { target: { value: "올해 목표" } });
    fireEvent.click(screen.getByText("추가"));

    await waitFor(async () => {
      const list = await prisma.todo.findMany({});
      expect(list).toHaveLength(1);
      expect(list[0].periodType).toBe("YEARLY");
    });
  });
});
