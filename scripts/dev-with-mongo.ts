/**
 * Dev entrypoint that boots a local MongoDB (via mongodb-memory-server, no
 * Docker required) as a single-node replica set, writes DATABASE_URL to
 * .env.local, then runs `next dev` as a child process so the mongod
 * lifetime matches the dev server's lifetime.
 *
 * The dbPath is wiped and recreated on every start (see clearStaleLock/
 * main below) rather than persisted: MongoMemoryReplSet always runs
 * replSetInitiate on startup, and doing that against a dbPath that already
 * has a replica set config from a previous run causes the connection to
 * reset instead of completing. Local dev data therefore does not survive a
 * `npm run dev` restart, which is an acceptable tradeoff for a Docker-free
 * sandboxed dev setup.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const nextBin = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * This dbPath is only ever used by this single dev script (one mongod at a
 * time). If the previous run was killed ungracefully (e.g. a hard kill that
 * doesn't propagate to grandchild processes), the mongod process it spawned
 * can survive as an orphan holding the dbPath lock, and mongod.lock still
 * contains that orphan's PID. Since we own this directory exclusively, it's
 * safe to terminate that specific orphaned process (matched by the exact
 * PID recorded in the lock file) and clear the lock before starting.
 */
async function clearStaleLock(dbPath: string) {
  const lockFile = resolve(dbPath, "mongod.lock");
  if (!existsSync(lockFile)) return;

  const pid = Number(readFileSync(lockFile, "utf8").trim());
  if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) {
    // eslint-disable-next-line no-console
    console.log(`[dev-with-mongo] found orphaned mongod (pid ${pid}) from a previous unclean shutdown, terminating it`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
    for (let i = 0; i < 20 && isProcessAlive(pid); i++) {
      await sleep(100);
    }
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(lockFile, { force: true });
      return;
    } catch {
      await sleep(100);
    }
  }
  // If it's still locked after all retries, let MongoMemoryReplSet.create
  // surface the real "DBPathInUse" error rather than swallowing it.
}

async function main() {
  const dbPath = resolve(process.cwd(), ".mongo-data");
  if (existsSync(dbPath)) {
    // Kill any orphaned mongod still holding the previous run's data first,
    // otherwise the wipe below fails with EBUSY on Windows.
    await clearStaleLock(dbPath);
    // MongoMemoryReplSet always runs replSetInitiate on startup. Data left
    // over from a previous run already has a replica set config on disk,
    // and re-initiating against that stale config causes the new mongod to
    // reset the driver's connection instead of completing init. A clean
    // dbPath every run avoids that entirely; local dev data intentionally
    // does not persist across `npm run dev` restarts.
    rmSync(dbPath, { recursive: true, force: true });
  }
  mkdirSync(dbPath, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger", dbName: "tododb" },
    instanceOpts: [{ dbPath, storageEngine: "wiredTiger" }],
  });

  const uri = replSet.getUri("tododb");
  writeFileSync(resolve(process.cwd(), ".env.local"), `DATABASE_URL="${uri}"\n`);
  // eslint-disable-next-line no-console
  console.log(`[dev-with-mongo] local MongoDB replica set ready: ${uri}`);

  // `shell: true` is required on Windows to spawn the .cmd shim (spawning
  // it directly throws EINVAL); safe here since the command and args are
  // static, not derived from user input.
  const child = spawn(nextBin, ["dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: uri },
  });

  let shuttingDown = false;
  const shutdown = async (code: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill();
    await replSet.stop();
    process.exit(code);
  };

  child.on("exit", (code) => shutdown(code ?? 0));
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[dev-with-mongo] failed to start:", err);
  process.exit(1);
});
