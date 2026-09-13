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
      className={`flex min-h-[240px] flex-col gap-2 rounded-lg border-2 p-3 transition-colors ${
        isOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-slate-500">{LABELS[status]}</h3>
        <span className="text-xs text-slate-400">{todos.length}</span>
      </div>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} />
        ))}
      </SortableContext>
    </div>
  );
}
