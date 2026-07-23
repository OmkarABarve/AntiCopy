/**
 * Root `npm run dev`: check ports, then start backend + frontend together.
 * Windows-safe: pass a single shell command so "npm run …" stays quoted.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function main() {
  const backendFree = await portFree(8000);
  const frontendFree = await portFree(3000);

  if (!backendFree || !frontendFree) {
    console.error("\n[anticopy] Cannot start — port(s) already in use:\n");
    if (!backendFree) {
      console.error("  • :8000  (backend)  — stop the other uvicorn / python process");
    }
    if (!frontendFree) {
      console.error("  • :3000  (frontend) — stop the other `next dev` process");
    }
    console.error(`
On Windows, free them with:

  netstat -ano | findstr ":8000 :3000"
  taskkill /PID <pid> /F

Then from the repo root:

  npm run dev

Or run sides separately:

  cd backend && npm run dev
  cd frontend && npm run dev
`);
    process.exit(1);
  }

  // One shell string with quoted concurrently commands — required on Windows.
  // Without quotes, cmd splits "npm run dev:backend" into separate processes.
  const cmd =
    'npx concurrently -n backend,frontend -c cyan,magenta "npm run dev:backend" "npm run dev:frontend"';

  const child = spawn(cmd, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      try {
        process.kill(process.pid, signal);
      } catch {
        /* ignore */
      }
    }
    process.exit(code ?? 0);
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      if (!child.killed) child.kill(sig);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
