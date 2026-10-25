// Runs the API server (with reload) and the Vite dev server together.
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
const procs = [
  run(process.execPath, ["--env-file-if-exists=.env", "--watch-path=server", "--watch-path=shared", "server/index.js"]),
  run("npx", ["vite"]),
];
const stop = () => { procs.forEach(p => p.kill()); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach(p => p.on("exit", code => { if (code) stop(); }));
