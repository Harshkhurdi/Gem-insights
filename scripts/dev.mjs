import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { supervise } from "./process-supervisor.mjs";
if (existsSync(".env")) process.loadEnvFile(".env");
const origin = new URL(process.env.WEB_ORIGIN || "http://localhost:3000");
const webPort = origin.port || (origin.protocol === "https:" ? "443" : "80");
const build = spawnSync("npm", ["run", "build", "-w", "@gem/api"], {
  stdio: "inherit",
});
if (build.error || build.signal || build.status !== 0) {
  console.error(
    "API build failed:",
    build.error?.message || build.signal || build.status,
  );
  process.exit(build.status || 1);
}
const launch = (name, command, args) => ({
  name,
  child: spawn(command, args, {
    stdio: "inherit",
    detached: process.platform !== "win32",
  }),
});
const services = [
  launch("API", process.execPath, [
    "--env-file-if-exists=.env",
    "apps/api/dist/apps/api/src/main.js",
  ]),
  launch("Worker", process.execPath, [
    "--env-file-if-exists=.env",
    "apps/api/dist/apps/api/src/worker.js",
  ]),
  // Explicit port prevents Next from silently selecting 3001, which would no
  // longer match WEB_ORIGIN and would break administrator requests.
  launch("Web UI", "npm", [
    "run",
    "dev",
    "-w",
    "@gem/web",
    "--",
    "--port",
    webPort,
  ]),
];
supervise(services);
console.log(
  `Dashboard: ${origin.origin} — PostgreSQL must be running and migrated.`,
);
