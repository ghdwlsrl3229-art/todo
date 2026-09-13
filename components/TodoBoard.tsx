"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useUpdateTodoStatus, useReorderTodos } from "@/hooks/useTodos";
import type { Status, Todo, TodosFilter } from "@/lib/types";
import { TodoColumn } from "./TodoColumn";

const STATUSES: Status[] = ["TODO", "DOING", "DONE"];

export function TodoBoard({ todos, filter }: { todos: Todo[]; filter: TodosFilter }) {
  const updateStatus = useUpdateTodoStatus(filter);
  const reorder = useReorderTodos(filter);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columns: Record<Status, Todo[]> = {
    TODO: todos.filter((t) => t.status === "TODO"),
    DOING: todos.filter((t) => t.status === "DOING"),
    DONE: todos.filter((t) => t.status === "DONE"),
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const activeStatus = (active.data.current?.status as Status | undefined) ?? undefined;
    if (!activeStatus) return;

    const overId = String(over.id);
    const isOverColumn = (STATUSES as string[]).includes(overId);
    const overStatus = isOverColumn
      ? (overId as Status)
      : ((over.data.current?.status as Status | undefined) ?? activeStatus);

    if (overStatus !== activeStatus) {
      // cross-column move: change status (optimistic + rollback on failure).
      // Land at the end of the destination column rather than wherever its
      // existing order values happen to sort a default/unset order to.
      const destColumnTodos = columns[overStatus];
      const newOrder =
        destColumnTodos.length === 0 ? 0 : Math.max(...destColumnTodos.map((t) => t.order)) + 1;
      updateStatus.mutate({ id: activeId, status: overStatus, order: newOrder });
      return;
    }

    // same-column reorder
    if (isOverColumn) return; // dropped on empty column area, no reorder needed
    const columnTodos = columns[activeStatus];
    const oldIndex = columnTodos.findIndex((t) => t.id === activeId);
    const newIndex = columnTodos.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = [...columnTodos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorder.mutate({ status: activeStatus, orderedIds: reordered.map((t) => t.id) });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATUSES.map((status) => (
          <TodoColumn key={status} status={status} todos={columns[status]} />
        ))}
      </div>
    </DndContext>
  );
}
