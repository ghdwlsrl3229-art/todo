"use client";

import { useState } from "react";
import { useCreateTodo, useTodosQuery } from "@/hooks/useTodos";
import { calcYearlyProgress } from "@/lib/progress";
import type { PeriodType } from "@/lib/types";

export function ChildrenPanel({
  parentId,
  parentTargetDate,
  childPeriodType,
  showProgress,
}: {
  parentId: string;
  parentTargetDate: string;
  childPeriodType: PeriodType;
  showProgress?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(parentTargetDate.slice(0, 10));
  const createTodo = useCreateTodo();

  const { data: children, isLoading } = useTodosQuery({
    parentId,
    periodType: childPeriodType,
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTodo.mutate(
      { title: trimmed, periodType: childPeriodType, targetDate: date, parentId },
      { onSuccess: () => setTitle("") }
    );
  };

  return (
    <div className="mt-2 space-y-1 border-l-2 border-hairline pl-2">
      {showProgress && children && (
        <p className="text-[13px] font-semibold leading-[1.23] text-primary">
          연결 진행률: {calcYearlyProgress(children)}%
        </p>
      )}

      {isLoading && <p className="text-[13px] text-muted-soft">불러오는 중...</p>}
      {!isLoading && (!children || children.length === 0) && (
        <p className="text-[13px] text-muted-soft">연결된 하위 항목 없음</p>
      )}
      {children?.map((c) => (
        <div key={c.id} className="flex items-center justify-between text-[13px] leading-[1.23] text-body">
          <span>{c.title}</span>
          <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-semibold text-muted">
            {c.status}
          </span>
        </div>
      ))}

      <form onSubmit={handleAdd} className="mt-1 flex flex-wrap items-center gap-1">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="하위 항목 추가"
          className="min-w-0 flex-1 rounded-sm border border-hairline px-1.5 py-1 text-[13px] text-ink placeholder:text-muted-soft focus:border-2 focus:border-ink focus:outline-none"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded-sm border border-hairline px-1.5 py-1 text-[13px] text-ink"
        />
        <button
          type="submit"
          onPointerDown={(e) => e.stopPropagation()}
          disabled={createTodo.isPending || !title.trim()}
          className="rounded-md bg-primary px-3 py-1 text-[13px] font-medium text-white hover:bg-primary-active disabled:bg-primary-disabled"
        >
          추가
        </button>
      </form>
      {createTodo.isError && (
        <p className="text-[13px] text-error">{(createTodo.error as Error).message}</p>
      )}
    </div>
  );
}
