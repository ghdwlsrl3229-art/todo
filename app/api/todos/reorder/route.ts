import { NextRequest, NextResponse } from "next/server";
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

  const { status, orderedIds } = parsed.data;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.todo.update({
        where: { id },
        data: { order: index, status },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
