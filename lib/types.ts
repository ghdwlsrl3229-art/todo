export type Status = "TODO" | "DOING" | "DONE";
export type PeriodType = "DAILY" | "WEEKLY" | "YEARLY";

export interface Todo {
  id: string;
  title: string;
  status: Status;
  periodType: PeriodType;
  targetDate: string;
  order: number;
  parentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodosFilter {
  periodType?: PeriodType;
  status?: Status;
  targetDate?: string;
  parentId?: string | null;
}
