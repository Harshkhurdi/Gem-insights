import { Collection } from "../apps/api/src/collection/service";
import { raipur } from "./collection-fixtures";
import { migrations } from "../apps/api/src/migrations";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { makePdf, sampleText } from "./pdf-fixtures";
import { promises as fs } from "node:fs";
import { DataSource } from "typeorm";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "HTTP tests require isolated TEST_DATABASE_URL ending in _test",
  );
const db = new DataSource({
  type: "postgres",
  url,
  migrations,
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
  COLLECTION_ENABLED: "false",
  PORT: "4511",
  WEB_ORIGIN: origin,
  ADMIN_KEY: key,
  DOCUMENT_STORAGE_DIR: ".runtime/pdf-http-tests",
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
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
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
  await fs.rm(".runtime/pdf-http-tests", { recursive: true, force: true });
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

test("PDF upload authentication runs before accepting file content", async () => {
  const form = new FormData();
  form.append("file", new Blob([makePdf([sampleText()])]), "test.pdf");
  const r = await fetch(base + "admin/documents/upload", {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
  assert.equal(r.status, 401);
});
test("multipart PDF batch is processed by worker and requires explicit review before analytics", async () => {
  const batch = await request("admin/documents/batches", {
    sourcePortal: "gem",
    sourceName: "SYNTHETIC HTTP PDF source",
    provenance: "SYNTHETIC HTTP PDF TEST ONLY",
    permissionNotes: "Generated PDF fixture with test processing rights",
    authorizedProcessing: true,
    retainContent: false,
    retainEvidence: true,
    allowOcr: false,
  });
  assert.equal(batch.status, 201);
  const b = await batch.json();
  const form = new FormData();
  form.append("batchId", b.id);
  form.append("sourceUrl", "https://example.org/synthetic-pdf");
  form.append(
    "file",
    new Blob([makePdf([sampleText({ product: "Ultrasound machine" })])]),
    "test.pdf",
  );
  const r = await fetch(base + "admin/documents/upload", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: form,
  });
  assert.equal(r.status, 202);
  const u = await r.json();
  await waitFor(async () => {
    const d = await (await request("admin/documents/" + u.id)).json();
    return d.status === "review";
  });
  const detail = await (await request("admin/documents/" + u.id)).json();
  assert.equal((await (await request("overview")).json()).tenders, 1);
  assert.equal(
    (await request("admin/documents/" + u.id + "/file")).status,
    410,
  );
  const review = {
    version: detail.draft.version,
    record: detail.draft.record,
    reason: "Checked every synthetic source page",
    completeSnapshot: true,
    reviewedAllPages: true,
    expectedTenderHash: null,
    classifications: {},
  };
  const approved = await request(
    "admin/documents/" + u.id + "/review/approve",
    review,
  );
  assert.equal(approved.status, 201);
  assert.equal((await (await request("overview")).json()).tenders, 2);
  assert.equal(
    (await (await request("admin/documents")).json()).summary.approved_tenders,
    1,
  );
  const duplicate = await fetch(base + "admin/documents/upload", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: form,
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
});
test("document batch cannot be created without processing rights", async () => {
  assert.equal(
    (
      await request("admin/documents/batches", {
        sourcePortal: "gem",
        sourceName: "TEST",
        provenance: "TEST ONLY RIGHTS",
        permissionNotes: "No rights granted for this test",
        authorizedProcessing: false,
        retainContent: false,
        retainEvidence: true,
        allowOcr: false,
      })
    ).status,
    400,
  );
});
test("generic job retry cannot bypass document retry checks", async () => {
  const id = randomUUID();
  await db.query(
    "INSERT INTO job(id,kind,status,payload) VALUES($1,'pdf','failed','{}')",
    [id],
  );
  assert.equal((await request("admin/jobs/" + id + "/retry", {})).status, 409);
  const job = (await db.query("SELECT status FROM job WHERE id=$1", [id]))[0];
  assert.equal(job.status, "failed");
});
test("SYNTHETIC unenrolled document returns JSON null for corpus editor", async () => {
  const d = (await db.query("SELECT id FROM upload_document LIMIT 1"))[0];
  const r = await request("admin/documents/" + d.id + "/corpus");
  assert.equal(r.status, 200);
  assert.equal(await r.json(), null);
});
test("collection routes validate filters, authorization and supported sources", async () => {
  assert.equal((await request("admin/collection/run", {}, false)).status, 401);
  assert.equal(
    (
      await request(
        "admin/collection/run",
        {},
        true,
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("admin/collection/run", { sourceId: "gem" })).status,
    409,
  );
  assert.equal(
    (await request("admin/collection/run", { sourceId: "unknown" })).status,
    404,
  );
  assert.equal((await request("collection/notices?page=0")).status, 400);
  const summary = await (await request("collection")).json();
  assert.equal(summary.states.length, 36);
  assert.equal(summary.nationalCompleteness, null);
});
test("reviewed collected native reference reaches existing analytics through HTTP", async () => {
  const collection = new Collection(db, async () => raipur(), 0);
  await collection.run("aiims-raipur");
  const notice = (await collection.notices({ page: 1, source: "aiims-raipur" }))
    .rows[0];
  assert.equal(
    (await request("admin/collection/notices/" + notice.id, undefined, false))
      .status,
    401,
  );
  const detail = await (
    await request("admin/collection/notices/" + notice.id)
  ).json();
  assert.equal(detail.currentTender, null);
  const initialOverview = await (
    await request("overview?source=aiims-raipur")
  ).json();
  assert.equal(initialOverview.tenders, 1);
  assert.equal(initialOverview.listing_notices, 1);
  const mainListing = await (await request("tenders/" + notice.id)).json();
  assert.equal(mainListing.evidence_level, "listing");
  assert.equal(mainListing.items[0].quantity, null);
  assert.equal(mainListing.observations.length, 1);
  assert.equal(
    (
      await (
        await request("overview?evidence=reviewed&source=aiims-raipur")
      ).json()
    ).tenders,
    0,
  );
  assert.equal((await request("overview?evidence=invalid")).status, 400);
  const extractPath = "admin/collection/notices/" + notice.id + "/extract";
  const extraction = { expectedHash: notice.current_hash, documentIndex: 0 };
  assert.equal((await request(extractPath, extraction, false)).status, 401);
  assert.equal(
    (await request(extractPath, extraction, true, "https://untrusted.example"))
      .status,
    403,
  );
  assert.equal(
    (await request(extractPath, { ...extraction, documentIndex: -1 })).status,
    400,
  );
  assert.equal((await request(extractPath, extraction)).status, 409);
  const body = {
    expectedHash: notice.current_hash,
    expectedTenderHash: null,
    reason: "SYNTHETIC source pages reviewed",
    reviewedOriginal: true,
    completeSnapshot: true,
    record: {
      sourcePortal: "institution",
      bidNumber: notice.bid_number,
      title: notice.title,
      sourceUrl: notice.source_url,
      buyer: {
        key: "HTTP-COLLECTION-TEST",
        name: "SYNTHETIC collection hospital",
        state: "Chhattisgarh",
      },
      items: [
        {
          key: "one",
          name: "Patient monitors",
          quantity: "4",
          unit: "pieces",
          evidence: "SYNTHETIC source page 1",
        },
      ],
    },
  };
  assert.equal(
    (
      await request("admin/collection/notices/" + notice.id + "/approve", {
        ...body,
        reviewedOriginal: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("admin/collection/notices/" + notice.id + "/approve", body))
      .status,
    201,
  );
  assert.equal((await (await request("collection")).json()).counts.approved, 1);
  const integratedOverview = await (
    await request("overview?source=aiims-raipur")
  ).json();
  assert.equal(integratedOverview.tenders, 1);
  assert.equal(integratedOverview.reviewed_tenders, 1);
  assert.equal(integratedOverview.listing_notices, 0);
  assert.equal(
    (await request("admin/collection/notices/" + notice.id + "/approve", body))
      .status,
    409,
  );
});
test("worker reclassification refreshes collected notices after alias edits without resetting review or observation age", async () => {
  await new Collection(
    db,
    async () =>
      raipur("SYNTHETIC Zeta clinical device", "", "GEM/2026/B/777777"),
    0,
  ).run("aiims-raipur");
  const [notice] = await db.query(
    "SELECT * FROM discovered_notice WHERE bid_number='GEM/2026/B/777777'",
  );
  assert.equal(notice.medical_candidate, false);
  await db.query(
    "UPDATE discovered_notice SET review_status='dismissed',last_seen='2026-10-19T00:00:00Z' WHERE id=$1",
    [notice.id],
  );
  const [product] = await db.query(
    "SELECT aliases FROM product WHERE id='patient-monitors'",
  );
  try {
    await db.query(
      "UPDATE product SET aliases=aliases || '[\"Zeta clinical device\"]'::jsonb WHERE id='patient-monitors'",
    );
    const response = await request("admin/reclassify", {});
    assert.equal(response.status, 201);
    const { jobId } = await response.json();
    await waitFor(
      async () =>
        (await db.query("SELECT status FROM job WHERE id=$1", [jobId]))[0]
          ?.status === "succeeded",
    );
    const [updated] = await db.query(
      "SELECT * FROM discovered_notice WHERE id=$1",
      [notice.id],
    );
    assert.equal(updated.medical_candidate, true);
    assert.deepEqual(updated.products, ["patient-monitors"]);
    assert.equal(updated.review_status, "dismissed");
    assert.equal(
      new Date(updated.last_seen).toISOString(),
      "2026-10-19T00:00:00.000Z",
    );
    await new Collection(
      db,
      async () =>
        raipur("SYNTHETIC Zeta clinical device", "", "GEM/2026/B/777777"),
      0,
    ).run("aiims-raipur");
    assert.equal(
      (
        await db.query(
          "SELECT review_status FROM discovered_notice WHERE id=$1",
          [notice.id],
        )
      )[0].review_status,
      "dismissed",
    );
  } finally {
    await db.query(
      "UPDATE product SET aliases=$1 WHERE id='patient-monitors'",
      [JSON.stringify(product.aliases)],
    );
  }
});
test("logout invalidates browser cookie", async () => {
  const r = await request("auth/logout", {});
  assert.equal(r.status, 201);
  assert.match(r.headers.get("set-cookie")!, /Expires=/);
});
test("SYNTHETIC evaluation and corpus routes reject unauthenticated access", async () => {
  for (const path of [
    "admin/documents/corpus",
    "admin/documents/evaluation",
    "admin/documents/batches",
  ])
    assert.equal((await request(path, undefined, false)).status, 401);
});
