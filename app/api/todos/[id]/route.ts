import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateTodoSchema } from "@/lib/validation";
import { normalizeForPeriod } from "@/lib/period";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  const parsed = updateTodoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.todo.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { title, periodType, targetDate, status, parentId } = parsed.data;

  const data: Prisma.TodoUpdateInput = {};
  if (title !== undefined) data.title = title;
  if (periodType !== undefined) data.periodType = periodType;
  if (parentId !== undefined) {
    data.parent = parentId === null ? { disconnect: true } : { connect: { id: parentId } };
  }

  const effectivePeriodType = periodType ?? existing.periodType;
  if (targetDate !== undefined) {
    data.targetDate = normalizeForPeriod(targetDate, effectivePeriodType);
  } else if (periodType !== undefined) {
    // periodType changed without an explicit new targetDate: re-normalize
    // the existing date under the new period type so filters stay correct.
    data.targetDate = normalizeForPeriod(existing.targetDate, effectivePeriodType);
  }

  if (status !== undefined) {
    data.status = status;
    if (status === "DONE" && existing.status !== "DONE") {
      data.completedAt = new Date();
    } else if (status !== "DONE" && existing.status === "DONE") {
      data.completedAt = null;
    }
  }

  try {
    const updated = await prisma.todo.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = await prisma.todo.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { parentId: params.id },
      data: { parentId: null },
    }),
    prisma.todo.delete({ where: { id: params.id } }),
  ]);

  return new NextResponse(null, { status: 204 });
}
