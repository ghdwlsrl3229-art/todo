import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reorderSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // `status` identifies which column is being reordered but is intentionally
  // not written here: this endpoint only reorders items already in that
  // column, and writing status separately from the completedAt transition
  // logic in [id]/route.ts would let a caller set DONE without completedAt.
  const { orderedIds } = parsed.data;

  try {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.todo.update({
          where: { id },
          data: { order: index },
        })
      )
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
