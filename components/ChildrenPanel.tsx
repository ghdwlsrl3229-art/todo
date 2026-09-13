"use client";

import { useTodosQuery } from "@/hooks/useTodos";
import { calcYearlyProgress } from "@/lib/progress";
import type { PeriodType } from "@/lib/types";

export function ChildrenPanel({
  parentId,
  childPeriodType,
  showProgress,
}: {
  parentId: string;
  childPeriodType: PeriodType;
  showProgress?: boolean;
}) {
  const { data: children, isLoading } = useTodosQuery({
    parentId,
    periodType: childPeriodType,
  });

  if (isLoading) {
    return <p className="text-xs text-slate-400">불러오는 중...</p>;
  }

  if (!children || children.length === 0) {
    return <p className="text-xs text-slate-400">연결된 하위 항목 없음</p>;
  }

  return (
    <div className="mt-2 space-y-1 border-l-2 border-slate-200 pl-2">
      {showProgress && (
        <p className="text-xs font-medium text-emerald-700">
          연결 진행률: {calcYearlyProgress(children)}%
        </p>
      )}
      {children.map((c) => (
        <div key={c.id} className="flex items-center justify-between text-xs text-slate-600">
          <span>{c.title}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.status}</span>
        </div>
      ))}
    </div>
  );
}
