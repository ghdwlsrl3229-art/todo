"use client";

import { useState } from "react";
import { useCreateTodo, useTodosQuery } from "@/hooks/useTodos";
import type { PeriodType } from "@/lib/types";

const parentPeriodTypeFor = (p: PeriodType): PeriodType | undefined => {
  if (p === "DAILY") return "WEEKLY";
  if (p === "WEEKLY") return "YEARLY";
  return undefined;
};

export function CreateTodoForm({
  periodType,
  referenceDate,
}: {
  periodType: PeriodType;
  referenceDate: string;
}) {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const createTodo = useCreateTodo();

  const parentPeriodType = parentPeriodTypeFor(periodType);
  const { data: parentOptions } = useTodosQuery(
    { periodType: parentPeriodType ?? "DAILY" },
    { enabled: Boolean(parentPeriodType) }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    createTodo.mutate(
      {
        title: trimmed,
        periodType,
        targetDate: referenceDate,
        parentId: parentId || null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setParentId("");
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="할 일 제목"
        className="h-12 min-w-[200px] flex-1 rounded-sm border border-hairline bg-white px-4 text-[16px] leading-[1.5] text-ink placeholder:text-muted-soft focus:border-2 focus:border-ink focus:outline-none"
      />
      {parentPeriodType && (
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="h-12 rounded-sm border border-hairline bg-white px-3 text-[14px] text-ink focus:border-2 focus:border-ink focus:outline-none"
        >
          <option value="">상위 목표 없음</option>
          {parentOptions?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={createTodo.isPending || !title.trim()}
        className="h-12 rounded-md bg-primary px-6 text-[16px] font-medium leading-[1.25] text-white transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
      >
        추가
      </button>
      {createTodo.isError && (
        <p className="w-full text-[14px] text-error">
          {(createTodo.error as Error).message}
        </p>
      )}
    </form>
  );
}
