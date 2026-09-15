import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import type { User } from "@prisma/client";

let counter = 0;

/**
 * Clears Todo/Session/User in dependency order (Todo.userId is a required
 * relation, so it must go first or a later user.deleteMany would fail).
 * Call this in every auth-aware test file's beforeEach.
 */
export async function resetTestDb(): Promise<void> {
  await prisma.todo.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

/** Creates a User directly via Prisma, bypassing the real GitHub OAuth flow. */
export async function createTestUser(overrides?: Partial<{ username: string; avatarUrl: string }>): Promise<User> {
  counter += 1;
  return prisma.user.create({
    data: {
      githubId: `test-${counter}-${randomBytes(4).toString("hex")}`,
      username: overrides?.username ?? `testuser${counter}`,
      avatarUrl: overrides?.avatarUrl ?? "https://example.com/avatar.png",
    },
  });
}

/** Creates a session for the given user and returns a ready-to-use Cookie header value. */
export async function authCookieFor(userId: string): Promise<string> {
  const { token } = await createSession(userId);
  return `session_token=${token}`;
}
