import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import type { User } from "@prisma/client";

let counter = 0;

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
