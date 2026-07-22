/**
 * Cross-platform backend launcher for `npm run dev`.
 * Uses backend/.venv when present; falls back to system python/py.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const winPy = path.join(backend, ".venv", "Scripts", "python.exe");
const unixPy = path.join(backend, ".venv", "bin", "python");

function resolvePython() {
  if (fs.existsSync(winPy)) return { cmd: winPy, argsPrefix: [] };
  if (fs.existsSync(unixPy)) return { cmd: unixPy, argsPrefix: [] };
  if (process.platform === "win32") {
    return { cmd: "py", argsPrefix: ["-3"] };
  }
  return { cmd: "python3", argsPrefix: [] };
}

const { cmd, argsPrefix } = resolvePython();
const args = [
  ...argsPrefix,
  "-m",
  "uvicorn",
  "app.main:app",
  "--host",
  "127.0.0.1",
  "--port",
  "8000",
  "--reload",
];

const child = spawn(cmd, args, {
  cwd: backend,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

child.on("error", (err) => {
  console.error(
    `[backend] Failed to start (${cmd}). Create the venv first:\n` +
      `  cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt`,
  );
  console.error(err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}
