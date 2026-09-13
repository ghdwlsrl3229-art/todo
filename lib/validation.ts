import { z } from "zod";

export const StatusEnum = z.enum(["TODO", "DOING", "DONE"]);
export const PeriodTypeEnum = z.enum(["DAILY", "WEEKLY", "YEARLY"]);

export const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/i;
export const isValidObjectId = (id: string) => OBJECT_ID_REGEX.test(id);
const objectIdSchema = z.string().regex(OBJECT_ID_REGEX, "invalid id");

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  periodType: PeriodTypeEnum,
  targetDate: z.coerce.date(),
  parentId: objectIdSchema.nullable().optional(),
});

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1, "title is required").optional(),
    periodType: PeriodTypeEnum.optional(),
    targetDate: z.coerce.date().optional(),
    status: StatusEnum.optional(),
    parentId: objectIdSchema.nullable().optional(),
    order: z.number().int().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "at least one field must be provided",
  });

export const reorderSchema = z.object({
  status: StatusEnum,
  orderedIds: z.array(objectIdSchema).min(1),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
