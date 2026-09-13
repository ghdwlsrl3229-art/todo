import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/session";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_CLIENT_ID is not configured" }, { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${request.nextUrl.origin}/auth/github/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "read:user");

  const response = NextResponse.redirect(authorizeUrl, { status: 302 });
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60, // 10 minutes, only needs to survive the redirect round-trip
    path: "/",
  });
  return response;
}
