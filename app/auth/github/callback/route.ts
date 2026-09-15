import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/session";
import { exchangeCodeForToken, fetchGithubUser, GithubOAuthError } from "@/lib/github-oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  let accessToken: string;
  let githubUser: Awaited<ReturnType<typeof fetchGithubUser>>;
  try {
    accessToken = await exchangeCodeForToken(code);
    githubUser = await fetchGithubUser(accessToken);
  } catch (err) {
    const message = err instanceof GithubOAuthError ? err.message : "GitHub login failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const githubId = String(githubUser.id);
  let token: string;
  let expiresAt: Date;
  try {
    const user = await prisma.user.upsert({
      where: { githubId },
      create: { githubId, username: githubUser.login, avatarUrl: githubUser.avatar_url },
      update: { username: githubUser.login, avatarUrl: githubUser.avatar_url },
    });
    ({ token, expiresAt } = await createSession(user.id));
  } catch (err) {
    // Most commonly a misconfigured/missing DATABASE_URL in this
    // environment (e.g. a deploy target that doesn't derive it the way
    // local dev does). Logged server-side for diagnosis; the client only
    // gets a generic message, no internals.
    // eslint-disable-next-line no-console
    console.error("[auth/github/callback] failed to persist user/session:", err);
    return NextResponse.json({ error: "login failed while saving the session" }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 302 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}
