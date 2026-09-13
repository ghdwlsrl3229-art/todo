import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSessionByToken, getUserByToken } from "@/lib/session";
import { createTestUser } from "../helpers/auth";

beforeEach(async () => {
  // Todo must be cleared before User: Todo.userId is a required relation,
  // and a leftover Todo from another test file's last run would make
  // user.deleteMany fail with a referential-integrity error.
  await prisma.todo.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

describe("createSession / getUserByToken", () => {
  it("returns the owning user for a valid token", async () => {
    const user = await createTestUser({ username: "alice" });
    const { token } = await createSession(user.id);

    const found = await getUserByToken(token);
    expect(found?.id).toBe(user.id);
    expect(found?.username).toBe("alice");
  });

  it("stores only a hash of the token, not the raw token", async () => {
    const user = await createTestUser();
    const { token } = await createSession(user.id);

    const sessions = await prisma.session.findMany({});
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(token);
  });

  it("returns null for an unknown token", async () => {
    const found = await getUserByToken("not-a-real-token");
    expect(found).toBeNull();
  });

  it("returns null and deletes the row for an expired session", async () => {
    const user = await createTestUser();
    const { token } = await createSession(user.id);
    // force it into the past
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.session.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const found = await getUserByToken(token);
    expect(found).toBeNull();

    const stillExists = await prisma.session.findUnique({ where: { tokenHash } });
    expect(stillExists).toBeNull();
  });
});

describe("deleteSessionByToken", () => {
  it("removes the session so the token no longer resolves to a user", async () => {
    const user = await createTestUser();
    const { token } = await createSession(user.id);
    expect(await getUserByToken(token)).not.toBeNull();

    await deleteSessionByToken(token);

    expect(await getUserByToken(token)).toBeNull();
  });
});
