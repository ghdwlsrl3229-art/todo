"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Status, Todo } from "@/lib/types";
import { TodoCard } from "./TodoCard";

const LABELS: Record<Status, string> = {
  TODO: "todo",
  DOING: "doing",
  DONE: "done",
};

export function TodoColumn({ status, todos }: { status: Status; todos: Todo[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={`flex min-h-[240px] flex-col gap-2 rounded-md border p-3 transition-colors ${
        isOver ? "border-ink bg-surface-soft" : "border-hairline bg-surface-soft"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[12px] font-bold uppercase leading-[1.33] tracking-[0.32px] text-muted">
          {LABELS[status]}
        </h3>
        <span className="text-[13px] leading-[1.23] text-muted-soft">{todos.length}</span>
      </div>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} />
        ))}
      </SortableContext>
    </div>
  );
}
