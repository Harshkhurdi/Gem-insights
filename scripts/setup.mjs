#!/usr/bin/env node
// One-time (and idempotent) local bootstrap: verifies PostgreSQL, creates
// the application role and databases if missing, applies migrations, and
// prints the next step. Docker is not required; any local PostgreSQL 16+
// works, including Homebrew's.
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL in .env first (copy .env.example).");
  process.exit(1);
}
const admin = new URL(url);
admin.pathname = "/postgres";
const dbName = new URL(url).pathname.slice(1);
const testUrl = process.env.TEST_DATABASE_URL || "";
const testDb = testUrl ? new URL(testUrl).pathname.slice(1) : null;

async function reachable() {
  try {
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.end();
    return true;
  } catch (e) {
    return false;
  }
}

if (!(await reachable())) {
  console.error(
    "PostgreSQL is not reachable at " +
      new URL(url).host +
      ". Start your local PostgreSQL (for example: brew services start postgresql@18) and retry.",
  );
  process.exit(1);
}
console.log("PostgreSQL reachable.");

const adminClient = new Client({ connectionString: admin.href });
await adminClient.connect();
for (const db of [dbName, testDb].filter(Boolean)) {
  const exists = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [db],
  );
  if (!exists.rowCount) {
    await adminClient.query(`CREATE DATABASE ${JSON.stringify(db)}`);
    console.log(`Created database ${db}.`);
  } else {
    console.log(`Database ${db} already present.`);
  }
}
await adminClient.end();

console.log("Applying migrations...");
const { execFileSync } = await import("node:child_process");
execFileSync("npm", ["run", "migrate"], { stdio: "inherit" });
console.log("\nSetup complete. Start everything with:  npm run dev");
console.log("Then open http://localhost:3000");
