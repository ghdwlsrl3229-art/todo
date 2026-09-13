import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "session_token";
export const OAUTH_STATE_COOKIE_NAME = "oauth_state";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a session and returns the raw token to set as a cookie. Only the
 * SHA-256 hash is stored, so a database read alone can't be used to forge a
 * valid session cookie.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function getUserByToken(token: string): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** For API route handlers, which receive the request directly. */
export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserByToken(token);
}

/** For Server Components (e.g. app/page.tsx), which read via next/headers. */
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserByToken(token);
}
