"use client";

import { useState } from "react";
import { useTodosQuery } from "@/hooks/useTodos";
import { todayIsoLocal } from "@/lib/date";
import { PERIOD_LABELS, PERIOD_TYPES } from "@/lib/labels";
import type { PeriodType } from "@/lib/types";

export function HistoryPanel() {
  const [periodType, setPeriodType] = useState<PeriodType>("WEEKLY");
  const [date, setDate] = useState<string>(todayIsoLocal());

  const { data: todos, isLoading } = useTodosQuery({
    status: "DONE",
    periodType,
    targetDate: date,
  });

  const sorted = [...(todos ?? [])].sort((a, b) => {
    const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="mt-8 rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">완료 이력</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as PeriodType)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {PERIOD_TYPES.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      {isLoading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {!isLoading && sorted.length === 0 && (
        <p className="text-sm text-slate-400">완료된 항목이 없습니다.</p>
      )}
      <ul className="space-y-1">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-center justify-between text-sm">
            <span>{t.title}</span>
            <span className="text-xs text-slate-400">
              {t.completedAt ? new Date(t.completedAt).toLocaleString() : "-"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
