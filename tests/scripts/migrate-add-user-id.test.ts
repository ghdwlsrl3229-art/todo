import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { migrateOrphanedTodosToUser } from "../../scripts/migrate-add-user-id";
import { createTestUser } from "../helpers/auth";

beforeEach(async () => {
  await prisma.todo.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

/**
 * Inserts a Todo document without a `userId`, the way pre-auth data would
 * look. The typed Prisma Client can't create this directly since userId is
 * a required field in the schema, so this uses a raw insert -- exactly the
 * gap the migration script exists to close.
 */
async function insertOrphanedTodo(title: string) {
  await prisma.$runCommandRaw({
    insert: "Todo",
    documents: [
      {
        title,
        status: "TODO",
        periodType: "DAILY",
        targetDate: { $date: "2026-09-14T00:00:00.000Z" },
        order: 0,
        createdAt: { $date: new Date().toISOString() },
        updatedAt: { $date: new Date().toISOString() },
      },
    ],
  });
}

describe("migrateOrphanedTodosToUser", () => {
  it("throws if the target username doesn't exist", async () => {
    await expect(migrateOrphanedTodosToUser("nobody")).rejects.toThrow(/No User found/);
  });

  it("assigns userId-less todos to the given user and leaves owned todos untouched", async () => {
    const target = await createTestUser({ username: "migrate-target" });
    const other = await createTestUser({ username: "already-owns-one" });
    await insertOrphanedTodo("orphan 1");
    await insertOrphanedTodo("orphan 2");
    await prisma.todo.create({
      data: {
        title: "already owned",
        periodType: "DAILY",
        targetDate: new Date("2026-09-14"),
        owner: { connect: { id: other.id } },
      },
    });

    await migrateOrphanedTodosToUser("migrate-target");

    const all = await prisma.todo.findMany({});
    expect(all).toHaveLength(3);
    const orphans = all.filter((t) => t.title.startsWith("orphan"));
    expect(orphans).toHaveLength(2);
    expect(orphans.every((t) => t.userId === target.id)).toBe(true);

    const untouched = all.find((t) => t.title === "already owned");
    expect(untouched?.userId).toBe(other.id);
  });
});
