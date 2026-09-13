import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as GITHUB_START } from "@/app/auth/github/route";
import { GET as GITHUB_CALLBACK } from "@/app/auth/github/callback/route";
import { POST as LOGOUT } from "@/app/auth/logout/route";
import { GET as TODOS_GET } from "@/app/api/todos/route";
import { prisma } from "@/lib/prisma";
import { OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/session";

function req(url: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  return new NextRequest(new Request(url, { ...init, headers }));
}

/** Extracts a `name=value` cookie assignment from a Set-Cookie header set on a response. */
function getSetCookie(res: Response, name: string): string | undefined {
  const all = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  const match = all.find((c) => c.startsWith(`${name}=`));
  return match?.split(";")[0];
}

beforeEach(async () => {
  // Todo must be cleared before User: Todo.userId is a required relation,
  // and a leftover Todo from another test file's last run would make
  // user.deleteMany fail with a referential-integrity error.
  await prisma.todo.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /auth/github", () => {
  it("redirects to GitHub's authorize URL with client_id/redirect_uri/state/scope, and sets the oauth_state cookie", async () => {
    const res = await GITHUB_START(req("http://localhost/auth/github"));
    expect(res.status).toBe(302);

    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost/auth/github/callback");
    expect(location.searchParams.get("scope")).toBe("read:user");
    expect(location.searchParams.get("state")).toBeTruthy();

    const stateCookie = getSetCookie(res, OAUTH_STATE_COOKIE_NAME);
    expect(stateCookie).toBeTruthy();
    expect(stateCookie).toContain(location.searchParams.get("state")!);
  });
});

describe("GET /auth/github/callback", () => {
  it("rejects with 400 when code is missing", async () => {
    const res = await GITHUB_CALLBACK(req("http://localhost/auth/github/callback?state=abc", {}, `${OAUTH_STATE_COOKIE_NAME}=abc`));
    expect(res.status).toBe(400);
  });

  it("rejects with 400 when state doesn't match the oauth_state cookie", async () => {
    const res = await GITHUB_CALLBACK(
      req("http://localhost/auth/github/callback?code=abc&state=wrong", {}, `${OAUTH_STATE_COOKIE_NAME}=right`)
    );
    expect(res.status).toBe(400);
  });

  it("rejects with 400 when there is no oauth_state cookie at all (CSRF)", async () => {
    const res = await GITHUB_CALLBACK(req("http://localhost/auth/github/callback?code=abc&state=anything"));
    expect(res.status).toBe(400);
  });

  it("on success: creates the User, creates a Session, sets the cookie, redirects to /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.startsWith("https://github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "mock-access-token" }), { status: 200 });
        }
        if (url.startsWith("https://api.github.com/user")) {
          return new Response(
            JSON.stringify({ id: 424242, login: "octocat", avatar_url: "https://avatars.example/octocat.png" }),
            { status: 200 }
          );
        }
        throw new Error(`unhandled fetch in test: ${url}`);
      })
    );

    const res = await GITHUB_CALLBACK(
      req("http://localhost/auth/github/callback?code=valid-code&state=match", {}, `${OAUTH_STATE_COOKIE_NAME}=match`)
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");

    const user = await prisma.user.findUnique({ where: { githubId: "424242" } });
    expect(user?.username).toBe("octocat");
    expect(user?.avatarUrl).toBe("https://avatars.example/octocat.png");

    const sessions = await prisma.session.findMany({ where: { userId: user!.id } });
    expect(sessions).toHaveLength(1);

    const sessionCookie = getSetCookie(res, SESSION_COOKIE_NAME);
    expect(sessionCookie).toBeTruthy();

    // the new cookie actually authenticates a subsequent request
    const token = sessionCookie!.split("=")[1];
    const todosRes = await TODOS_GET(req("http://localhost/api/todos", {}, `${SESSION_COOKIE_NAME}=${token}`));
    expect(todosRes.status).toBe(200);
  });

  it("on a second login with the same githubId, updates the existing user instead of creating a duplicate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.startsWith("https://github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ id: 999, login: "renamed-user", avatar_url: "https://avatars.example/new.png" }),
          { status: 200 }
        );
      })
    );

    await prisma.user.create({
      data: { githubId: "999", username: "old-name", avatarUrl: "https://avatars.example/old.png" },
    });

    await GITHUB_CALLBACK(req("http://localhost/auth/github/callback?code=c&state=s", {}, `${OAUTH_STATE_COOKIE_NAME}=s`));

    const users = await prisma.user.findMany({ where: { githubId: "999" } });
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("renamed-user");
  });
});

describe("POST /auth/logout", () => {
  it("deletes the session and clears the cookie; the old cookie is then unauthenticated", async () => {
    const user = await prisma.user.create({
      data: { githubId: "logout-test", username: "logout-user", avatarUrl: "https://avatars.example/x.png" },
    });
    const { createSession } = await import("@/lib/session");
    const { token } = await createSession(user.id);
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    const before = await TODOS_GET(req("http://localhost/api/todos", {}, cookie));
    expect(before.status).toBe(200);

    const logoutRes = await LOGOUT(req("http://localhost/auth/logout", { method: "POST" }, cookie));
    expect(logoutRes.status).toBe(200);

    const remaining = await prisma.session.findMany({});
    expect(remaining).toHaveLength(0);

    const after = await TODOS_GET(req("http://localhost/api/todos", {}, cookie));
    expect(after.status).toBe(401);
  });
});
