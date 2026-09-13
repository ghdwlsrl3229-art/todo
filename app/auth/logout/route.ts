import { NextRequest, NextResponse } from "next/server";
import { deleteSessionByToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
