"use client";

import { useState } from "react";
import { useTodosQuery } from "@/hooks/useTodos";
import { calcWeeklyProgress } from "@/lib/progress";
import { todayIsoLocal } from "@/lib/date";
import type { PeriodType } from "@/lib/types";
import { PeriodTabs } from "./PeriodTabs";
import { CreateTodoForm } from "./CreateTodoForm";
import { TodoBoard } from "./TodoBoard";
import { ProgressBar } from "./ProgressBar";
import { HistoryPanel } from "./HistoryPanel";

export function TodoApp() {
  const [periodType, setPeriodType] = useState<PeriodType>("DAILY");
  const [referenceDate, setReferenceDate] = useState<string>(todayIsoLocal());

  const filter = { periodType, targetDate: referenceDate };
  const { data: todos, isLoading, isError, error } = useTodosQuery(filter);

  return (
    <div>
      <PeriodTabs
        active={periodType}
        onChange={setPeriodType}
        referenceDate={referenceDate}
        onReferenceDateChange={setReferenceDate}
      />

      <CreateTodoForm periodType={periodType} referenceDate={referenceDate} />

      {periodType === "WEEKLY" && todos && (
        <ProgressBar percent={calcWeeklyProgress(todos)} label="주간 진행률" />
      )}

      {isLoading && <p className="text-[14px] text-muted-soft">불러오는 중...</p>}
      {isError && (
        <p className="text-[14px] text-error">
          {(error as Error)?.message ?? "목록을 불러오지 못했습니다."}
        </p>
      )}
      {todos && <TodoBoard todos={todos} filter={filter} />}

      <HistoryPanel />
    </div>
  );
}
