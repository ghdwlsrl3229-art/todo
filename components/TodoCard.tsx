"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDeleteTodo, useUpdateTodo } from "@/hooks/useTodos";
import { PERIOD_LABELS, PERIOD_TYPES } from "@/lib/labels";
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
  const [periodType, setPeriodType] = useState<PeriodType>(todo.periodType);
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

  const saveEdits = () => {
    const trimmed = title.trim();
    const titleChanged = trimmed && trimmed !== todo.title;
    const periodChanged = periodType !== todo.periodType;

    if (!titleChanged && !periodChanged) {
      setTitle(todo.title);
      setEditing(false);
      return;
    }

    updateTodo.mutate(
      {
        id: todo.id,
        input: {
          ...(titleChanged ? { title: trimmed } : {}),
          ...(periodChanged ? { periodType } : {}),
        },
      },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-hairline bg-white p-3 transition-shadow hover:shadow-elevated"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        >
          {editing ? (
            <div className="flex flex-wrap items-center gap-1">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdits()}
                onPointerDown={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded-sm border border-hairline px-1.5 py-1 text-[14px] text-ink focus:border-2 focus:border-ink focus:outline-none"
              />
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-sm border border-hairline px-1.5 py-1 text-[13px] text-ink"
              >
                {PERIOD_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={saveEdits}
                className="rounded-md bg-primary px-3 py-1 text-[13px] font-medium text-white hover:bg-primary-active"
              >
                저장
              </button>
              {updateTodo.isError && (
                <p className="w-full text-[13px] text-error">{(updateTodo.error as Error).message}</p>
              )}
            </div>
          ) : (
            <p
              onDoubleClick={() => {
                setTitle(todo.title);
                setPeriodType(todo.periodType);
                setEditing(true);
              }}
              className="flex flex-wrap items-center gap-1.5 text-[16px] font-medium leading-[1.5] text-ink"
            >
              {todo.title}
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-semibold leading-[1.18] text-muted">
                {PERIOD_LABELS[todo.periodType]}
              </span>
            </p>
          )}
          {todo.completedAt && (
            <p className="mt-1 text-[13px] leading-[1.23] text-muted-soft">
              완료: {new Date(todo.completedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deleteTodo.mutate(todo.id)}
          className="text-[13px] leading-[1.23] text-muted-soft transition-colors hover:text-error"
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
            className="text-[13px] leading-[1.23] text-muted underline decoration-hairline underline-offset-2 hover:text-ink"
          >
            {showChildren ? "하위 항목 숨기기" : "하위 항목 보기"}
          </button>
          {showChildren && (
            <ChildrenPanel
              parentId={todo.id}
              parentTargetDate={todo.targetDate}
              childPeriodType={childPeriodType}
              showProgress={todo.periodType === "YEARLY"}
            />
          )}
        </div>
      )}
    </div>
  );
}
