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
      <div className="flex gap-1 rounded-full bg-surface-soft p-1">
        {PERIOD_TYPES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-full px-4 py-1.5 text-[14px] font-medium leading-[1.29] transition ${
              active === value
                ? "bg-white text-ink shadow-elevated"
                : "text-muted hover:text-ink"
            }`}
          >
            {PERIOD_LABELS[value]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px] leading-[1.43] text-muted">
        기준일
        <input
          type="date"
          value={referenceDate}
          onChange={(e) => onReferenceDateChange(e.target.value)}
          className="rounded-sm border border-hairline px-2 py-1.5 text-[14px] text-ink focus:border-2 focus:border-ink focus:outline-none"
        />
      </label>
    </div>
  );
}
