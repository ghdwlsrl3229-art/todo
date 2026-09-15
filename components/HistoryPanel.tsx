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
    <div className="mt-8 rounded-md border border-hairline bg-white p-4">
      <h2 className="mb-3 text-[16px] font-semibold leading-[1.25] text-ink">완료 이력</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as PeriodType)}
          className="rounded-sm border border-hairline px-2 py-1.5 text-[14px] text-ink focus:border-2 focus:border-ink focus:outline-none"
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
          className="rounded-sm border border-hairline px-2 py-1.5 text-[14px] text-ink focus:border-2 focus:border-ink focus:outline-none"
        />
      </div>
      {isLoading && <p className="text-[14px] text-muted-soft">불러오는 중...</p>}
      {!isLoading && sorted.length === 0 && (
        <p className="text-[14px] text-muted-soft">완료된 항목이 없습니다.</p>
      )}
      <ul className="divide-y divide-hairline-soft">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2 text-[14px] leading-[1.43] text-body">
            <span>{t.title}</span>
            <span className="text-[13px] leading-[1.23] text-muted-soft">
              {t.completedAt ? new Date(t.completedAt).toLocaleString() : "-"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
