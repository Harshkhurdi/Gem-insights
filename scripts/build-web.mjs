import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const web = fileURLToPath(new URL("../apps/web/", import.meta.url));
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
// Runtime route-cache files can contain HTML and asset references from a previous
// build. A production build must ship one consistent set of generated files.
await rm(new URL("../apps/web/.next/", import.meta.url), {
  recursive: true,
  force: true,
});
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  { cwd: web, stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
