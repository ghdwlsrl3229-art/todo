"use client";

import type { PeriodType } from "@/lib/types";

const TABS: { value: PeriodType; label: string }[] = [
  { value: "DAILY", label: "일일" },
  { value: "WEEKLY", label: "주간" },
  { value: "YEARLY", label: "1년" },
];

export function PeriodTabs({
  active,
  onChange,
  referenceDate,
  onReferenceDateChange,
}: {
  active: PeriodType;
  onChange: (p: PeriodType) => void;
  referenceDate: string;
  onReferenceDateChange: (d: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active === tab.value
                ? "bg-white text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        기준일
        <input
          type="date"
          value={referenceDate}
          onChange={(e) => onReferenceDateChange(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}
