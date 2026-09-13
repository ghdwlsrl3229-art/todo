"use client";

import { PERIOD_LABELS, PERIOD_TYPES } from "@/lib/labels";
import type { PeriodType } from "@/lib/types";

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
        {PERIOD_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active === value
                ? "bg-white text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {PERIOD_LABELS[value]}
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
