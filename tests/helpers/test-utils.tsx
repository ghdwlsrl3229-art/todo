/**
 * Shared helpers for component/integration tests that render real hooks
 * and components against the real Next.js route handlers (no mocking),
 * so they exercise the same code path the browser would use.
 */
import { vi } from "vitest";
import { NextRequest } from "next/server";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GET, POST } from "@/app/api/todos/route";
import { DELETE, PATCH } from "@/app/api/todos/[id]/route";
import { PATCH as REORDER } from "@/app/api/todos/reorder/route";

export function stubFetchToRouteHandlers() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : (input as Request).url;
      const url = new URL(rawUrl, "http://localhost");
      const method = (init?.method ?? "GET").toUpperCase();
      const nextReq = new NextRequest(new Request(url.toString(), init));

      if (url.pathname === "/api/todos" && method === "GET") return GET(nextReq);
      if (url.pathname === "/api/todos" && method === "POST") return POST(nextReq);
      if (url.pathname === "/api/todos/reorder" && method === "PATCH") return REORDER(nextReq);

      const idMatch = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
      if (idMatch && method === "PATCH") return PATCH(nextReq, { params: { id: idMatch[1] } });
      if (idMatch && method === "DELETE") return DELETE(nextReq, { params: { id: idMatch[1] } });

      throw new Error(`unhandled fetch in test: ${method} ${url.pathname}`);
    })
  );
}

export function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
