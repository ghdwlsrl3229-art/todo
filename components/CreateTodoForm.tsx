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
        className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {parentPeriodType && (
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
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
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        추가
      </button>
      {createTodo.isError && (
        <p className="w-full text-sm text-red-600">
          {(createTodo.error as Error).message}
        </p>
      )}
    </form>
  );
}
