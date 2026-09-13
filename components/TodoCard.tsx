"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDeleteTodo, useUpdateTodo } from "@/hooks/useTodos";
import type { PeriodType, Todo } from "@/lib/types";
import { ChildrenPanel } from "./ChildrenPanel";

const childPeriodTypeFor = (p: PeriodType): PeriodType | undefined => {
  if (p === "YEARLY") return "WEEKLY";
  if (p === "WEEKLY") return "DAILY";
  return undefined;
};

export function TodoCard({ todo }: { todo: Todo }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [showChildren, setShowChildren] = useState(false);

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id, data: { status: todo.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const childPeriodType = childPeriodTypeFor(todo.periodType);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === todo.title) {
      setTitle(todo.title);
      setEditing(false);
      return;
    }
    updateTodo.mutate(
      { id: todo.id, input: { title: trimmed } },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        >
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded border border-slate-300 px-1 py-0.5 text-sm"
            />
          ) : (
            <p
              onDoubleClick={() => setEditing(true)}
              className="text-sm font-medium text-slate-800"
            >
              {todo.title}
            </p>
          )}
          {todo.completedAt && (
            <p className="mt-1 text-[11px] text-slate-400">
              완료: {new Date(todo.completedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deleteTodo.mutate(todo.id)}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label="삭제"
        >
          삭제
        </button>
      </div>

      {childPeriodType && (
        <div className="mt-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowChildren((v) => !v)}
            className="text-[11px] text-slate-400 underline"
          >
            {showChildren ? "하위 항목 숨기기" : "하위 항목 보기"}
          </button>
          {showChildren && (
            <ChildrenPanel
              parentId={todo.id}
              childPeriodType={childPeriodType}
              showProgress={todo.periodType === "YEARLY"}
            />
          )}
        </div>
      )}
    </div>
  );
}
