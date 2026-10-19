import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { Initial1792400000000 } from "../apps/api/src/migrations/initial";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "HTTP tests require isolated TEST_DATABASE_URL ending in _test",
  );
const db = new DataSource({
  type: "postgres",
  url,
  migrations: [Initial1792400000000],
  synchronize: false,
});
const key = randomBytes(32).toString("hex");
const origin = "http://localhost:4512",
  base = "http://127.0.0.1:4511/api/";
let server: ChildProcess,
  worker: ChildProcess,
  cookie = "";
const env = {
  ...process.env,
  DATABASE_URL: url,
  PORT: "4511",
  WEB_ORIGIN: origin,
  ADMIN_KEY: key,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function request(
  p: string,
  b?: any,
  auth = true,
  requestOrigin = origin,
) {
  return fetch(base + p, {
    method: b ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(b ? { Origin: requestOrigin } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body: b ? JSON.stringify(b) : undefined,
  });
}
async function waitFor(fn: () => Promise<boolean>, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(150);
  }
  throw new Error("Timed out waiting for HTTP/worker state");
}
before(async () => {
  await db.initialize();
  await db.runMigrations();
  await db.query(
    "TRUNCATE tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  server = spawn(process.execPath, ["apps/api/dist/apps/api/src/main.js"], {
    env,
    stdio: "ignore",
  });
  await waitFor(async () => {
    try {
      return (await request("health")).ok;
    } catch {
      return false;
    }
  });
  worker = spawn(process.execPath, ["apps/api/dist/apps/api/src/worker.js"], {
    env,
    stdio: "ignore",
  });
});
after(async () => {
  server?.kill("SIGTERM");
  worker?.kill("SIGTERM");
  if (worker)
    await new Promise((r) => {
      worker.once("exit", r);
      setTimeout(r, 2500).unref();
    });
  if (db.isInitialized) await db.destroy();
});
test("unauthenticated administration is rejected", async () =>
  assert.equal((await request("admin/review", undefined, false)).status, 401));
test("sign-in is origin restricted and invalid keys fail", async () => {
  assert.equal(
    (await request("auth/login", { key }, false, "https://untrusted.example"))
      .status,
    403,
  );
  assert.equal(
    (await request("auth/login", { key: "wrong" }, false)).status,
    401,
  );
});
test("administrator session is HTTP-only and same-site strict", async () => {
  const r = await request("auth/login", { key }, false);
  assert.equal(r.status, 201);
  const h = r.headers.get("set-cookie")!;
  assert.match(h, /HttpOnly/);
  assert.match(h, /SameSite=Strict/i);
  cookie = h.split(";")[0];
  assert.equal((await request("admin/review")).status, 200);
});
test("unverified live source synchronization is explicitly blocked", async () =>
  assert.equal((await request("admin/ingestion/run", {})).status, 409));
test("queued authorized import is processed by separate worker", async () => {
  const r = await request("admin/import", {
    authorized: true,
    provenance: "SYNTHETIC HTTP TEST ONLY",
    records: [
      {
        bidNumber: "GEM/2026/B/70000001",
        title: "SYNTHETIC HTTP TEST FIXTURE ONLY",
        sourceUrl: "https://example.org/test",
        publishedAt: "2026-10-01",
        buyer: {
          key: "HTTP-TEST",
          name: "Synthetic HTTP test buyer",
          state: "Punjab",
        },
        items: [
          {
            key: "one",
            name: "Patient monitor",
            quantity: "3",
            unit: "pieces",
            evidence: "SYNTHETIC TEST ONLY",
          },
        ],
      },
    ],
  });
  assert.equal(r.status, 202);
  const j = await r.json();
  await waitFor(async () => {
    const job = (await db.query("SELECT * FROM job WHERE id=$1", [j.jobId]))[0];
    return job.status === "succeeded";
  });
  const overview = await (await request("overview")).json();
  assert.equal(overview.tenders, 1);
  const products = await (await request("products")).json();
  assert.equal(products[0].quantities.units, 3);
});
test("import authorization and DTO validation are required", async () => {
  assert.equal(
    (
      await request("admin/import", {
        authorized: false,
        provenance: "TEST ONLY",
        records: [],
      })
    ).status,
    400,
  );
  assert.equal((await request("tenders?limit=1000")).status, 400);
});
test("worker records failure and applies bounded retry state", async () => {
  const id = randomUUID();
  await db.query("INSERT INTO job(id,kind,payload) VALUES($1,'import',$2)", [
    id,
    JSON.stringify({ records: [{}], provenance: "TEST INVALID INPUT" }),
  ]);
  await waitFor(async () => {
    const j = (await db.query("SELECT * FROM job WHERE id=$1", [id]))[0];
    return j.attempts === 1 && j.status === "pending";
  });
  const job = (await db.query("SELECT * FROM job WHERE id=$1", [id]))[0];
  assert.ok(job.last_error);
  assert.ok(new Date(job.available_at) > new Date(job.locked_at));
  await db.query("UPDATE job SET attempts=2,available_at=now() WHERE id=$1", [
    id,
  ]);
  await waitFor(async () => {
    const j = (await db.query("SELECT * FROM job WHERE id=$1", [id]))[0];
    return j.status === "failed";
  });
  const r = await request("admin/jobs/" + id + "/retry", {});
  assert.equal(r.status, 201);
});
test("logout invalidates browser cookie", async () => {
  const r = await request("auth/logout", {});
  assert.equal(r.status, 201);
  assert.match(r.headers.get("set-cookie")!, /Expires=/);
});
