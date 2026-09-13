import type { PeriodType } from "./types";

export const PERIOD_TYPES: PeriodType[] = ["DAILY", "WEEKLY", "YEARLY"];

export const PERIOD_LABELS: Record<PeriodType, string> = {
  DAILY: "일일",
  WEEKLY: "주간",
  YEARLY: "1년",
};
