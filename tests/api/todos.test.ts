import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/todos/route";
import { PATCH, DELETE } from "@/app/api/todos/[id]/route";
import { PATCH as REORDER } from "@/app/api/todos/reorder/route";
import { prisma } from "@/lib/prisma";
import { authCookieFor, createTestUser } from "../helpers/auth";

function req(url: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  return new NextRequest(new Request(url, { ...init, headers }));
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

let authCookie: string;

/** Authenticated request, using the current test's logged-in user. */
function areq(url: string, init?: RequestInit) {
  return req(url, init, authCookie);
}

beforeEach(async () => {
  await prisma.todo.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  const user = await createTestUser();
  authCookie = await authCookieFor(user.id);
});

describe("authentication", () => {
  it("returns 401 for every route without a session cookie", async () => {
    const getRes = await GET(req("http://localhost/api/todos"));
    expect(getRes.status).toBe(401);

    const postRes = await POST(
      req("http://localhost/api/todos", jsonInit("POST", { title: "x", periodType: "DAILY", targetDate: "2026-09-14" }))
    );
    expect(postRes.status).toBe(401);

    const patchRes = await PATCH(
      req("http://localhost/api/todos/000000000000000000000000", jsonInit("PATCH", { title: "x" })),
      { params: { id: "000000000000000000000000" } }
    );
    expect(patchRes.status).toBe(401);

    const deleteRes = await DELETE(req("http://localhost/api/todos/000000000000000000000000"), {
      params: { id: "000000000000000000000000" },
    });
    expect(deleteRes.status).toBe(401);

    const reorderRes = await REORDER(
      req("http://localhost/api/todos/reorder", jsonInit("PATCH", { status: "TODO", orderedIds: ["000000000000000000000000"] }))
    );
    expect(reorderRes.status).toBe(401);
  });

  it("returns 401 for a cookie that doesn't match any session (e.g. after logout)", async () => {
    const res = await GET(req("http://localhost/api/todos", {}, "session_token=not-a-real-token"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/todos", () => {
  it("creates a todo with default status TODO, owned by the caller", async () => {
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "Buy milk",
        periodType: "DAILY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("TODO");
    expect(body.title).toBe("Buy milk");
    expect(typeof body.userId).toBe("string");
  });

  it("ignores a client-supplied userId and uses the session user instead", async () => {
    const other = await createTestUser();
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "spoofed owner",
        periodType: "DAILY",
        targetDate: "2026-09-14",
        userId: other.id,
      }))
    );
    const body = await res.json();
    expect(body.userId).not.toBe(other.id);
  });

  it("rejects an empty/whitespace-only title with 400", async () => {
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "   ",
        periodType: "DAILY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid periodType with 400", async () => {
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "Bad period",
        periodType: "MONTHLY",
        targetDate: "2026-09-14",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects a malformed parentId with 400 (not a 500 from an unguarded db call)", async () => {
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "Bad parent", periodType: "DAILY", targetDate: "2026-09-14", parentId: "not-an-objectid",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects a well-formed but nonexistent parentId with 400", async () => {
    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "Dangling parent", periodType: "DAILY", targetDate: "2026-09-14", parentId: "000000000000000000000000",
      }))
    );
    expect(res.status).toBe(400);
  });

  it("rejects linking to another user's todo as parent with 400", async () => {
    const other = await createTestUser();
    const otherCookie = await authCookieFor(other.id);
    const otherParent = await (await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "other user's weekly", periodType: "WEEKLY", targetDate: "2026-09-14",
    }), otherCookie))).json();

    const res = await POST(
      areq("http://localhost/api/todos", jsonInit("POST", {
        title: "cross-user link attempt", periodType: "DAILY", targetDate: "2026-09-14", parentId: otherParent.id,
      }))
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/todos", () => {
  it("filters by periodType and targetDate (week-scoped)", async () => {
    await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly A", periodType: "WEEKLY", targetDate: "2026-09-17", // Thursday, same week
    })));
    await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly B (other week)", periodType: "WEEKLY", targetDate: "2026-09-21", // Monday, next week
    })));
    await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Daily C", periodType: "DAILY", targetDate: "2026-09-17",
    })));

    const res = await GET(areq("http://localhost/api/todos?periodType=WEEKLY&targetDate=2026-09-14"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("Weekly A");
  });

  it("filters by status", async () => {
    const created = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Doing item", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();
    await PATCH(
      areq(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { status: "DOING" })),
      { params: { id } }
    );

    const res = await GET(areq("http://localhost/api/todos?status=DOING"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("DOING");
  });

  it("rejects a malformed parentId query param with 400", async () => {
    const res = await GET(areq("http://localhost/api/todos?parentId=not-an-objectid"));
    expect(res.status).toBe(400);
  });

  it("only returns the caller's own todos, never another user's", async () => {
    const other = await createTestUser();
    const otherCookie = await authCookieFor(other.id);
    await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "other user's todo", periodType: "DAILY", targetDate: "2026-09-14",
    }), otherCookie));
    await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "my todo", periodType: "DAILY", targetDate: "2026-09-14",
    })));

    const res = await GET(areq("http://localhost/api/todos"));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("my todo");
  });
});

describe("PATCH /api/todos/:id", () => {
  it("updates title/status and sets completedAt when moved to DONE", async () => {
    const created = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Finish report", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { status: "DONE" })),
      { params: { id } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("DONE");
    expect(body.completedAt).not.toBeNull();
  });

  it("returns 404 for a well-formed but unknown id", async () => {
    const res = await PATCH(
      areq("http://localhost/api/todos/000000000000000000000000", jsonInit("PATCH", { title: "x" })),
      { params: { id: "000000000000000000000000" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 500) for a malformed id", async () => {
    const res = await PATCH(
      areq("http://localhost/api/todos/not-an-objectid", jsonInit("PATCH", { title: "x" })),
      { params: { id: "not-an-objectid" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when patching another user's todo (ownership, not existence, is what's checked)", async () => {
    const other = await createTestUser();
    const otherCookie = await authCookieFor(other.id);
    const otherTodo = await (await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "not yours", periodType: "DAILY", targetDate: "2026-09-14",
    }), otherCookie))).json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${otherTodo.id}`, jsonInit("PATCH", { title: "hijacked" })),
      { params: { id: otherTodo.id } }
    );
    expect(res.status).toBe(404);
  });

  it("updates periodType and re-normalizes targetDate under the new period", async () => {
    const created = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Retarget", periodType: "DAILY", targetDate: "2026-09-17", // Thursday
    })));
    const { id } = await created.json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { periodType: "WEEKLY" })),
      { params: { id } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.periodType).toBe("WEEKLY");
    // 2026-09-17 (Thu) normalizes to that week's Monday, 2026-09-14
    expect(body.targetDate).toBe("2026-09-14T00:00:00.000Z");
  });

  it("rejects a malformed parentId in the update body with 400", async () => {
    const created = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Bad link", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { parentId: "not-an-objectid" })),
      { params: { id } }
    );
    expect(res.status).toBe(400);
  });

  it("rejects setting a todo as its own parent with 400", async () => {
    const created = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Self link", periodType: "DAILY", targetDate: "2026-09-14",
    })));
    const { id } = await created.json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${id}`, jsonInit("PATCH", { parentId: id })),
      { params: { id } }
    );
    expect(res.status).toBe(400);
  });

  it("rejects a periodType change on a todo that still has a parent link (400, not a silent orphan)", async () => {
    const parentRes = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly parent", periodType: "WEEKLY", targetDate: "2026-09-14",
    })));
    const parent = await parentRes.json();

    const childRes = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Daily child", periodType: "DAILY", targetDate: "2026-09-14", parentId: parent.id,
    })));
    const child = await childRes.json();

    const res = await PATCH(
      areq(`http://localhost/api/todos/${child.id}`, jsonInit("PATCH", { periodType: "WEEKLY" })),
      { params: { id: child.id } }
    );
    expect(res.status).toBe(400);

    // unlinking first, then changing periodType, is allowed
    const okRes = await PATCH(
      areq(`http://localhost/api/todos/${child.id}`, jsonInit("PATCH", { parentId: null, periodType: "WEEKLY" })),
      { params: { id: child.id } }
    );
    expect(okRes.status).toBe(200);
  });
});

describe("DELETE /api/todos/:id", () => {
  it("returns 404 (not 500) for a malformed id", async () => {
    const res = await DELETE(areq("http://localhost/api/todos/not-an-objectid"), { params: { id: "not-an-objectid" } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another user's todo", async () => {
    const other = await createTestUser();
    const otherCookie = await authCookieFor(other.id);
    const otherTodo = await (await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "not yours", periodType: "DAILY", targetDate: "2026-09-14",
    }), otherCookie))).json();

    const res = await DELETE(areq(`http://localhost/api/todos/${otherTodo.id}`), { params: { id: otherTodo.id } });
    expect(res.status).toBe(404);

    const stillThere = await prisma.todo.findUnique({ where: { id: otherTodo.id } });
    expect(stillThere).not.toBeNull();
  });

  it("deletes a todo and clears parentId on its children", async () => {
    const parentRes = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Yearly goal", periodType: "YEARLY", targetDate: "2026-01-01",
    })));
    const parent = await parentRes.json();

    const childRes = await POST(areq("http://localhost/api/todos", jsonInit("POST", {
      title: "Weekly linked", periodType: "WEEKLY", targetDate: "2026-09-14", parentId: parent.id,
    })));
    const child = await childRes.json();

    const delRes = await DELETE(areq(`http://localhost/api/todos/${parent.id}`), { params: { id: parent.id } });
    expect(delRes.status).toBe(204);

    const refreshed = await prisma.todo.findUnique({ where: { id: child.id } });
    expect(refreshed?.parentId).toBeNull();

    const listRes = await GET(areq("http://localhost/api/todos"));
    const list = await listRes.json();
    expect(list.find((t: { id: string }) => t.id === parent.id)).toBeUndefined();
  });
});

describe("PATCH /api/todos/reorder", () => {
  it("persists the new order for a column", async () => {
    const a = await (await POST(areq("http://localhost/api/todos", jsonInit("POST", { title: "A", periodType: "DAILY", targetDate: "2026-09-14" })))).json();
    const b = await (await POST(areq("http://localhost/api/todos", jsonInit("POST", { title: "B", periodType: "DAILY", targetDate: "2026-09-14" })))).json();

    const res = await REORDER(areq("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "TODO",
      orderedIds: [b.id, a.id],
    })));
    expect(res.status).toBe(200);

    const refreshedA = await prisma.todo.findUnique({ where: { id: a.id } });
    const refreshedB = await prisma.todo.findUnique({ where: { id: b.id } });
    expect(refreshedB?.order).toBeLessThan(refreshedA?.order ?? Infinity);
  });

  it("does not let a reorder call set status/completedAt (not this endpoint's job)", async () => {
    const a = await (await POST(areq("http://localhost/api/todos", jsonInit("POST", { title: "A", periodType: "DAILY", targetDate: "2026-09-14" })))).json();

    await REORDER(areq("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "DONE",
      orderedIds: [a.id],
    })));

    const refreshed = await prisma.todo.findUnique({ where: { id: a.id } });
    expect(refreshed?.status).toBe("TODO");
    expect(refreshed?.completedAt).toBeNull();
  });

  it("returns 404 (not 500) for an unknown id in the transaction", async () => {
    const res = await REORDER(areq("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "TODO",
      orderedIds: ["000000000000000000000000"],
    })));
    expect(res.status).toBe(404);
  });

  it("rejects a malformed id in orderedIds with 400", async () => {
    const res = await REORDER(areq("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "TODO",
      orderedIds: ["not-an-objectid"],
    })));
    expect(res.status).toBe(400);
  });

  it("returns 404 (not a cross-user reorder) when an id belongs to another user", async () => {
    const other = await createTestUser();
    const otherCookie = await authCookieFor(other.id);
    const otherTodo = await (await POST(req("http://localhost/api/todos", jsonInit("POST", {
      title: "not yours", periodType: "DAILY", targetDate: "2026-09-14",
    }), otherCookie))).json();

    const res = await REORDER(areq("http://localhost/api/todos/reorder", jsonInit("PATCH", {
      status: "TODO",
      orderedIds: [otherTodo.id],
    })));
    expect(res.status).toBe(404);
  });
});
