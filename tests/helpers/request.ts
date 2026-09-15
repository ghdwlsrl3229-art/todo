import { NextRequest } from "next/server";

/** Builds a NextRequest for directly invoking a route handler in tests. */
export function req(url: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  return new NextRequest(new Request(url, { ...init, headers }));
}

export const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
