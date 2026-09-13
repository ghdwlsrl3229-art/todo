import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTodoSchema, isValidObjectId, PeriodTypeEnum, StatusEnum } from "@/lib/validation";
import { normalizeForPeriod } from "@/lib/period";
import { getUserFromRequest } from "@/lib/session";
import type { PeriodType } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const where: Prisma.TodoWhereInput = { userId: user.id };

  const periodTypeRaw = searchParams.get("periodType");
  let periodType: PeriodType | undefined;
  if (periodTypeRaw) {
    const parsed = PeriodTypeEnum.safeParse(periodTypeRaw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid periodType" }, { status: 400 });
    }
    periodType = parsed.data;
    where.periodType = parsed.data;
  }

  const statusRaw = searchParams.get("status");
  if (statusRaw) {
    const parsed = StatusEnum.safeParse(statusRaw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    where.status = parsed.data;
  }

  const targetDateRaw = searchParams.get("targetDate");
  if (targetDateRaw) {
    const parsedDate = new Date(targetDateRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "invalid targetDate" }, { status: 400 });
    }
    if (!periodType) {
      return NextResponse.json(
        { error: "periodType is required when targetDate is provided" },
        { status: 400 }
      );
    }
    where.targetDate = normalizeForPeriod(parsedDate, periodType);
  }

  const parentId = searchParams.get("parentId");
  if (parentId !== null) {
    if (parentId !== "null" && !isValidObjectId(parentId)) {
      return NextResponse.json({ error: "invalid parentId" }, { status: 400 });
    }
    where.parentId = parentId === "null" ? null : parentId;
  }

  const todos = await prisma.todo.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(todos);
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTodoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, periodType, targetDate, parentId } = parsed.data;
  const normalizedTargetDate = normalizeForPeriod(targetDate, periodType);

  if (parentId != null) {
    const parentExists = await prisma.todo.findUnique({ where: { id: parentId, userId: user.id } });
    if (!parentExists) {
      return NextResponse.json({ error: "parent not found" }, { status: 400 });
    }
  }

  const maxOrder = await prisma.todo.aggregate({
    where: { status: "TODO", userId: user.id },
    _max: { order: true },
  });

  const todo = await prisma.todo.create({
    data: {
      title,
      periodType,
      targetDate: normalizedTargetDate,
      status: "TODO",
      order: (maxOrder._max.order ?? 0) + 1,
      owner: { connect: { id: user.id } },
      ...(parentId != null ? { parent: { connect: { id: parentId } } } : {}),
    },
  });

  return NextResponse.json(todo, { status: 201 });
}
