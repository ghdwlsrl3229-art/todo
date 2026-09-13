import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/todos/route";
import { PATCH, DELETE } from "@/app/api/todos/[id]/route";
import { PATCH as REORDER } from "@/app/api/todos/reorder/route";
import { prisma } from "@/lib/prisma";

function req(url: string, init?: RequestInit) {
  return new NextRequest(new Request(url, init));
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

beforeEach(async () => {
  await prisma.todo.deleteMany({});
});

describe("POST /api/todos", () => {
  it("creates a todo with default status TODO", async () => {
    const res = await POST(
      req("http://localhost/api/todos", jsonInit("POST", {
        title: "Buy milk",
        periodType: "DAILY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("TODO");
    expect(body.title).toBe("Buy milk");
  });

  it("rejects an empty/whitespace-only title with 400", async () => {
    const res = await POST(
      req("http://localhost/api/todos", jsonInit("POST", {
        title: "   ",
        periodType: "DAILY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid periodType with 400", async () => {
    const res = await POST(
      req("http://localhost/api/todos", jsonInit("POST", {
        title: "Bad period",
        periodType: "MONTHLY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/todos", () => {
  it("filters by periodType and targetDate (week-scoped)", async () => {
    await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly A", periodType: "WEEKLY", targetDate: "2026-09-17", // Thursday, same week
    })));
    await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly B (other week)", periodType: "WEEKLY", targetDate: "2026-09-21", // Monday, next week
    })));
    await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Daily C", periodType: "DAILY", targetDate: "2026-09-17",
    })));

    const res = await GET(req("http://localhost/api/todos?periodType=WEEKLY&targetDate=2026-09-14"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Weekly A");
  });

  it("filters by status", async () => {
    const created = await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Doing item", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();
    await PATCH(
      req(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { status: "DOING" })),
      { params: { id } }
    );

    const res = await GET(req("http://localhost/api/todos?status=DOING"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("DOING");
  });
});

describe("PATCH /api/todos/:id", () => {
  it("updates title/status and sets completedAt when moved to DONE", async () => {
    const created = await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Finish report", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();

    const res = await PATCH(
      req(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { status: "DONE" })),
      { params: { id } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DONE");
    expect(body.completedAt).not.toBeNull();
  });

  it("returns 404 for an unknown id", async () => {
    const res = await PATCH(
      req("http://localhost/api/todos/000000000000000000000000", jsonInit("PATCH", { title: "x" })),
      { params: { id: "000000000000000000000000" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/todos/:id", () => {
  it("deletes a todo and clears parentId on its children", async () => {
    const parentRes = await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Yearly goal", periodType: "YEARLY", targetDate: "2026-01-01",
    })));
    const parent = await parentRes.json();

    const childRes = await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly linked", periodType: "WEEKLY", targetDate: "2026-09-14", parentId: parent.id,
    })));
    const child = await childRes.json();

    const delRes = await DELETE(req(`http://localhost/api/todos/${parent.id}`), { params: { id: parent.id } });
    expect(delRes.status).toBe(204);

    const refreshed = await prisma.todo.findUnique({ where: { id: child.id } });
    expect(refreshed?.parentId).toBeNull();

    const listRes = await GET(req("http://localhost/api/todos"));
    const list = await listRes.json();
    expect(list.find((t: { id: string }) => t.id === parent.id)).toBeUndefined();
  });
});

describe("PATCH /api/todos/reorder", () => {
  it("persists the new order for a column", async () => {
    const a = await (await POST(req("http://localhost/api/todos", jsonInit("POST", { title: "A", periodType: "DAILY", targetDate: "2026-09-14" })))).json();
    const b = await (await POST(req("http://localhost/api/todos", jsonInit("POST", { title: "B", periodType: "DAILY", targetDate: "2026-09-14" })))).json();

    const res = await REORDER(req("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "TODO",
      orderedIds: [b.id, a.id],
    })));
    expect(res.status).toBe(200);

    const refreshedA = await prisma.todo.findUnique({ where: { id: a.id } });
    const refreshedB = await prisma.todo.findUnique({ where: { id: b.id } });
    expect(refreshedB?.order).toBeLessThan(refreshedA?.order ?? Infinity);
  });
});
