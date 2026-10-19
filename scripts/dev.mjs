import { spawn, spawnSync } from "node:child_process";
const build = spawnSync("npm", ["run", "build", "-w", "@gem/api"], {
  stdio: "inherit",
});
if (build.status) process.exit(build.status);
const children = [
  spawn(
    process.execPath,
    [
      "--env-file-if-exists=.env",
      "--watch",
      "apps/api/dist/apps/api/src/main.js",
    ],
    { stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "apps/api/dist/apps/api/src/worker.js"],
    { stdio: "inherit" },
  ),
  spawn("npm", ["run", "dev", "-w", "@gem/web"], { stdio: "inherit" }),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    children.forEach((c) => c.kill(signal));
    process.exit(0);
  });
console.log(
  "Dashboard: http://localhost:3000 — PostgreSQL must be running and migrated.",
);
