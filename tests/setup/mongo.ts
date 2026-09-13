/**
 * Vitest global setup: boots an isolated in-memory MongoDB replica set for
 * the whole test run, points Prisma at it via DATABASE_URL, pushes the
 * schema, and tears everything down after the run.
 */
import { execSync } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger", dbName: "tododb_test" },
  });
  const uri = replSet.getUri("tododb_test");
  process.env.DATABASE_URL = uri;

  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: uri },
    stdio: "inherit",
  });
}

export async function teardown() {
  await replSet?.stop();
}
