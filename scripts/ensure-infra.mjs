import { spawnSync } from "node:child_process";
import net from "node:net";

const postgresHost = "127.0.0.1";
const postgresPort = 5432;
const timeoutMs = 30_000;
const retryDelayMs = 500;

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPostgres() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(postgresHost, postgresPort)) {
      console.log("Postgres is ready on localhost:5432.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  console.error("Timed out waiting for Postgres on localhost:5432.");
  process.exit(1);
}

console.log("Starting local Postgres and Redis with Docker Compose...");
run("docker", ["compose", "up", "-d"]);
await waitForPostgres();
