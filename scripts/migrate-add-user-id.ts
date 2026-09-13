/**
 * One-time migration for Todo documents that predate GitHub OAuth login and
 * so have no `userId`. Assigns all such orphaned todos to a given user.
 *
 * Usage: npx tsx scripts/migrate-add-user-id.ts <github-username>
 *
 * That user must already exist (i.e. have logged in via GitHub at least
 * once) before running this. Uses $runCommandRaw rather than the typed
 * Prisma Client for both the query and the update: Todo.userId is a
 * required field in prisma/schema.prisma, and the generated client throws
 * when deserializing a document that's missing a required field, so the
 * typed client can't safely touch these documents at all until after this
 * migration runs.
 */
import { prisma } from "../lib/prisma";

export interface MigrationResult {
  ok: true;
  userId: string;
  raw: unknown;
}

export async function migrateOrphanedTodosToUser(username: string): Promise<MigrationResult> {
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) {
    throw new Error(
      `No User found with username "${username}". They must log in via GitHub OAuth at least once before running this migration.`
    );
  }

  const raw = await prisma.$runCommandRaw({
    update: "Todo",
    updates: [
      {
        q: { userId: { $exists: false } },
        u: { $set: { userId: { $oid: user.id } } },
        multi: true,
      },
    ],
  });

  return { ok: true, userId: user.id, raw };
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: npx tsx scripts/migrate-add-user-id.ts <github-username>");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await migrateOrphanedTodosToUser(username);
    console.log(`Assigned orphaned todos to "${username}" (${result.userId}):`, result.raw);
  } catch (err) {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

// Only run as a CLI when executed directly (not when imported by tests).
if (require.main === module) {
  main().finally(() => prisma.$disconnect());
}
