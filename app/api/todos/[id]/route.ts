import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidObjectId, updateTodoSchema } from "@/lib/validation";
import { normalizeForPeriod } from "@/lib/period";
import { getUserFromRequest } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateTodoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.todo.findUnique({ where: { id: params.id, userId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { title, periodType, targetDate, status, parentId, order } = parsed.data;

  if (parentId != null) {
    if (parentId === params.id) {
      return NextResponse.json({ error: "a todo cannot be its own parent" }, { status: 400 });
    }
    const parentExists = await prisma.todo.findUnique({ where: { id: parentId, userId: user.id } });
    if (!parentExists) {
      return NextResponse.json({ error: "parent not found" }, { status: 400 });
    }
  }

  // A periodType change re-scopes which parent period this todo belongs
  // under (e.g. DAILY -> WEEKLY), so an existing link (kept or newly set in
  // this same request) would silently point at a now-wrong-level parent
  // and the todo would vanish from that parent's ChildrenPanel query while
  // still counting toward it in calcYearlyProgress's basis. Require the
  // link to be explicitly cleared first rather than doing that silently.
  const parentIdAfterUpdate = parentId !== undefined ? parentId : existing.parentId;
  if (periodType !== undefined && periodType !== existing.periodType && parentIdAfterUpdate != null) {
    return NextResponse.json(
      { error: "unlink parentId before changing periodType" },
      { status: 400 }
    );
  }

  const data: Prisma.TodoUpdateInput = {};
  if (title !== undefined) data.title = title;
  if (periodType !== undefined) data.periodType = periodType;
  if (order !== undefined) data.order = order;
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
      where: { id: params.id, userId: user.id },
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
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isValidObjectId(params.id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const existing = await prisma.todo.findUnique({ where: { id: params.id, userId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { parentId: params.id, userId: user.id },
      data: { parentId: null },
    }),
    prisma.todo.delete({ where: { id: params.id, userId: user.id } }),
  ]);

  return new NextResponse(null, { status: 204 });
}
