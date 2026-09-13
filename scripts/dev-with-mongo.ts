/**
 * Dev entrypoint. If .env has MONGODB_URI set (a real MongoDB, e.g. Atlas),
 * uses that directly. Otherwise boots a local MongoDB (via
 * mongodb-memory-server, no Docker required) as a single-node replica set.
 * Either way, writes DATABASE_URL to .env.local, then runs `next dev` as a
 * child process so any locally-started mongod's lifetime matches the dev
 * server's lifetime.
 *
 * When falling back to mongodb-memory-server, the dbPath is wiped and
 * recreated on every start (see killOrphanedMongod/main below) rather than
 * persisted: MongoMemoryReplSet always runs replSetInitiate on startup, and
 * doing that against a dbPath that already has a replica set config from a
 * previous run causes the connection to reset instead of completing. Local
 * dev data therefore does not survive a `npm run dev` restart in that mode,
 * which is an acceptable tradeoff for a Docker-free sandboxed dev setup.
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const nextBin = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

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
 * Confirms the given pid is actually a mongod process before we kill it.
 * Windows recycles pids, so trusting a stale lock file's pid on its own
 * risks terminating an unrelated process that happens to have reused it.
 */
function isMongodProcess(pid: number): boolean {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
        encoding: "utf8",
      });
      return out.toLowerCase().includes("mongod");
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" });
    return out.toLowerCase().includes("mongod");
  } catch {
    return false;
  }
}

/**
 * This dbPath is only ever used by this single dev script (one mongod at a
 * time). If the previous run was killed ungracefully (e.g. a hard kill that
 * doesn't propagate to grandchild processes), the mongod process it spawned
 * can survive as an orphan holding the dbPath lock, and mongod.lock still
 * contains that orphan's PID. Terminate that specific orphaned process
 * (matched by the exact PID recorded in the lock file, and re-confirmed to
 * actually be a mongod before killing it) so the dbPath wipe below doesn't
 * hit EBUSY.
 */
async function killOrphanedMongod(dbPath: string) {
  const lockFile = resolve(dbPath, "mongod.lock");
  if (!existsSync(lockFile)) return;

  const pid = Number(readFileSync(lockFile, "utf8").trim());
  if (!(Number.isInteger(pid) && pid > 0 && isProcessAlive(pid) && isMongodProcess(pid))) {
    return;
  }

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

async function startLocalMongo(): Promise<{ uri: string; replSet: MongoMemoryReplSet }> {
  const dbPath = resolve(process.cwd(), ".mongo-data");
  if (existsSync(dbPath)) {
    // Kill any orphaned mongod still holding the previous run's data first,
    // otherwise the wipe below fails with EBUSY on Windows.
    await killOrphanedMongod(dbPath);
    rmSync(dbPath, { recursive: true, force: true });
  }
  mkdirSync(dbPath, { recursive: true });

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger", dbName: "tododb" },
    instanceOpts: [{ dbPath, storageEngine: "wiredTiger" }],
  });

  const uri = replSet.getUri("tododb");
  // eslint-disable-next-line no-console
  console.log(`[dev-with-mongo] local MongoDB replica set ready: ${uri}`);
  return { uri, replSet };
}

async function main() {
  let uri: string;
  let replSet: MongoMemoryReplSet | undefined;

  if (process.env.MONGODB_URI) {
    uri = process.env.MONGODB_URI;
    // eslint-disable-next-line no-console
    console.log("[dev-with-mongo] using MONGODB_URI from .env (real MongoDB, not local)");
  } else {
    ({ uri, replSet } = await startLocalMongo());
  }

  writeFileSync(resolve(process.cwd(), ".env.local"), `DATABASE_URL="${uri}"\n`);

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
    await replSet?.stop();
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
