import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { Ingestion } from "../apps/api/src/ingestion";
import { digest } from "../packages/core/domain";
import { raipur, icmr, cppp } from "./collection-fixtures";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Collection tests require isolated TEST_DATABASE_URL ending in _test",
  );
const db = new DataSource({
  type: "postgres",
  url,
  migrations,
  synchronize: false,
});
const f = filterSchema.parse({ evidence: "reviewed" });
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL,next_collection_at=now(),last_error=NULL,last_success=NULL",
  );
});
const collection = (html = raipur()) => new Collection(db, async () => html, 0);
const record = (n: any, portal = "institution") => ({
  sourcePortal: portal,
  bidNumber: n.bid_number,
  title: n.title,
  sourceUrl: n.source_url,
  publishedAt: "2026-10-20",
  buyer: { key: "COLLECTION-TEST", name: "SYNTHETIC", state: "Chhattisgarh" },
  items: [
    {
      key: "monitor",
      name: "Patient monitors",
      quantity: "5",
      unit: "pieces",
      evidence: "SYNTHETIC ORIGINAL PAGE 1",
    },
  ],
});
test("collection stores discoveries without adding inferred demand", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  assert.equal((await c.summary()).counts.notices, 1);
  assert.equal((await new Analytics(db).overview(f)).tenders, 0);
  const n = (await c.notices({ page: 1, medical: true })).rows[0];
  assert.equal(n.documents.length, 2);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM notice_observation"))[0].n,
    1,
  );
});
test("identical collection is idempotent and records unchanged rows", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  await c.run("aiims-raipur");
  assert.equal((await c.summary()).counts.notices, 1);
  assert.equal(
    (await db.query("SELECT sum(unchanged)::int n FROM collection_run"))[0].n,
    1,
  );
});
test("changed listing retains observations and resets dismissed review", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await collection(raipur("Supply of ICU beds")).run("aiims-raipur");
  assert.equal((await c.notices({ page: 1 })).rows[0].review_status, "pending");
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM notice_observation"))[0].n,
    2,
  );
});
test("queue deduplicates per source, not across all sources", async () => {
  const c = collection();
  assert.equal((await c.queue()).queued, 64);
  assert.equal((await c.queue()).queued, 0);
  await assert.rejects(c.queue("gem"));
});
test("paused sources cannot be queued or collected", async () => {
  const c = collection();
  await db.query("UPDATE source SET enabled=false WHERE id='aiims-raipur'");
  assert.equal((await c.queue("aiims-raipur")).queued, 0);
  assert.deepEqual(await c.run("aiims-raipur"), { disabled: true });
});
test("failure after one page retains checkpoint and committed observations", async () => {
  let calls = 0;
  const c = new Collection(
    db,
    async () => {
      if (calls++) throw new Error("SYNTHETIC network failure");
      return raipur("Patient monitors", "tenders.php?page=2");
    },
    0,
  );
  await assert.rejects(c.run("aiims-raipur"), /network failure/);
  const s = (await db.query("SELECT * FROM source WHERE id='aiims-raipur'"))[0];
  assert.match(s.checkpoint, /page=2/);
  assert.equal((await c.summary()).counts.notices, 1);
  assert.equal(s.last_success, null);
  let requested = "";
  const resume = new Collection(
    db,
    async (u) => {
      requested = u;
      return raipur("Patient monitors", "", "SYNTHETIC/RAIPUR/2");
    },
    0,
  );
  await resume.run("aiims-raipur");
  assert.match(requested, /page=2/);
  assert.equal((await resume.summary()).counts.notices, 2);
});
test("cyclic pagination fails without reporting complete coverage", async () => {
  const c = new Collection(
    db,
    async () => raipur("Patient monitor", "tenders.php?page=2"),
    0,
  );
  await assert.rejects(c.run("aiims-raipur"), /pagination/);
  assert.equal((await c.summary()).nationalCompleteness, null);
});
test("broken layout is a failed run, not a zero-tender success", async () => {
  const c = collection("<title>Service unavailable</title>");
  await assert.rejects(c.run("aiims-raipur"));
  assert.equal(
    (await db.query("SELECT status FROM collection_run"))[0].status,
    "failed",
  );
  assert.match(
    (await db.query("SELECT last_error FROM source WHERE id='aiims-raipur'"))[0]
      .last_error,
    /table missing/,
  );
});
test("review imports exact quantities and preserves native tender identity", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  const n = (await c.notices({ page: 1 })).rows[0];
  await c.approve(n.id, {
    expectedHash: n.current_hash,
    expectedTenderHash: null,
    reason: "SYNTHETIC original checked",
    record: record(n),
  });
  assert.equal((await new Analytics(db).overview(f)).tenders, 1);
  assert.equal((await new Analytics(db).products(f))[0].quantities.units, 5);
  assert.equal((await c.summary()).counts.approved, 1);
  assert.equal(
    (await c.detail(n.id)).currentTender.raw.sourcePortal,
    "institution",
  );
  await assert.rejects(
    c.approve(n.id, {
      expectedHash: n.current_hash,
      expectedTenderHash: null,
      reason: "SYNTHETIC duplicate",
      record: record(n),
    }),
  );
});
test("stale notice and tender versions cannot overwrite reviewed records", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  const n = (await c.notices({ page: 1 })).rows[0];
  const b = {
    expectedHash: n.current_hash,
    expectedTenderHash: null,
    reason: "SYNTHETIC original checked",
    record: record(n),
  };
  await assert.rejects(
    c.approve(n.id, { ...b, expectedHash: "a".repeat(64) }),
    /changed/,
  );
  await new Ingestion(db).import(
    [record(n)],
    "SYNTHETIC newer reviewed record",
  );
  await assert.rejects(c.approve(n.id, b), /Tender changed/);
  assert.equal((await c.notices({ page: 1 })).rows[0].review_status, "pending");
});
test("source URL, portal and known reference cannot be changed during review", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  const n = (await c.notices({ page: 1 })).rows[0];
  for (const patch of [
    { sourceUrl: "https://example.org/different" },
    { sourcePortal: "cppp" },
    { bidNumber: "DIFFERENT/REF" },
  ])
    await assert.rejects(
      c.approve(n.id, {
        expectedHash: n.current_hash,
        expectedTenderHash: null,
        reason: "SYNTHETIC altered identity",
        record: { ...record(n), ...patch },
      }),
      /Keep the collected/,
    );
});
test("same native reference on different portals is stored as distinct tenders", async () => {
  const ingest = new Ingestion(db);
  const base = record({
    bid_number: "TEST/1",
    title: "SYNTHETIC",
    source_url: "https://example.org/test",
  });
  await ingest.import(
    [base, { ...base, sourcePortal: "cppp" }],
    "SYNTHETIC multi portal test",
  );
  assert.equal((await new Analytics(db).overview(f)).tenders, 2);
});
test("pagination and filters return exact discovery counts", async () => {
  const c = collection();
  await c.run("aiims-raipur");
  await new Collection(
    db,
    async () => icmr.replace(/<a rel="next"[^>]*>Next<\/a>/, ""),
    0,
  ).run("icmr");
  assert.equal((await c.notices({ page: 1, source: "aiims-raipur" })).total, 1);
  assert.equal((await c.notices({ page: 1, state: "Chhattisgarh" })).total, 1);
  assert.equal(
    (await c.notices({ page: 1, product: "lab-incubators" })).total,
    2,
  );
  assert.equal((await c.notices({ page: 1, search: "Nonexistent" })).total, 0);
});

test("rotating CPPP transport links do not reset reviewed notice classification", async () => {
  const c = new Collection(db, async () => cppp, 0);
  await c.run("cppp");
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await new Collection(
    db,
    async () =>
      cppp.replace("tendersfullview/synthetic", "tendersfullview/rotated"),
    0,
  ).run("cppp");
  const n = (await c.notices({ page: 1 })).rows[0];
  assert.equal(n.review_status, "dismissed");
  assert.match(n.source_url, /rotated/);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM notice_observation"))[0].n,
    1,
  );
});

test("backfill refreshes recent notices without rewinding its saved cursor", async () => {
  const requested: string[] = [];
  const c = new Collection(
    db,
    async (u) => {
      requested.push(u);
      return u.includes("page=50")
        ? raipur("Patient monitors", "tenders.php?page=51", "SYNTHETIC/OLDER")
        : raipur("Patient monitors", "tenders.php?page=2", "SYNTHETIC/NEW");
    },
    0,
    2,
  );
  await db.query("UPDATE source SET checkpoint=$2 WHERE id=$1", [
    "aiims-raipur",
    "https://www.aiimsraipur.edu.in/user/tenders.php?page=50",
  ]);
  await c.run("aiims-raipur");
  assert.equal(requested.length, 2);
  assert.match(requested[1], /page=50/);
  assert.equal((await c.summary()).counts.notices, 2);
  assert.match(
    (await db.query("SELECT checkpoint FROM source WHERE id='aiims-raipur'"))[0]
      .checkpoint,
    /page=51/,
  );
});
test("a failed recent-page refresh retains the historical checkpoint", async () => {
  await db.query("UPDATE source SET checkpoint=$2 WHERE id=$1", [
    "aiims-raipur",
    "https://www.aiimsraipur.edu.in/user/tenders.php?page=50",
  ]);
  const c = new Collection(
    db,
    async () => {
      throw new Error("SYNTHETIC recent page unavailable");
    },
    0,
    2,
  );
  await assert.rejects(c.run("aiims-raipur"));
  assert.match(
    (await db.query("SELECT checkpoint FROM source WHERE id='aiims-raipur'"))[0]
      .checkpoint,
    /page=50/,
  );
});

test("institution coverage migration refreshes candidates while preserving decisions, ages and pauses", async () => {
  const { InstitutionCoverage1792411000000 } =
    await import("../apps/api/src/migrations/institution-coverage");
  await collection(raipur("SYNTHETIC ELISA kits")).run("aiims-raipur");
  const n = (await db.query("SELECT * FROM discovered_notice"))[0];
  const raw = {
    ...n.raw,
    medical: false,
    reason: "SYNTHETIC legacy unmatched",
  };
  await db.query(
    "UPDATE discovered_notice SET raw=$2,current_hash=$3,medical_candidate=false,review_status='dismissed',review_reason='SYNTHETIC operator decision',last_seen='2026-10-19T00:00:00Z' WHERE id=$1",
    [n.id, JSON.stringify(raw), digest(raw)],
  );
  await db.query(
    "UPDATE source SET enabled=false,checkpoint='https://www.icmr.gov.in/tenders?page=2' WHERE id='icmr'",
  );
  await db.query(
    "UPDATE source SET adapter=NULL,enabled=false,listing_url='https://kmscl.kerala.gov.in/',checkpoint='https://kmscl.kerala.gov.in/old' WHERE id='kmscl'",
  );
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    await new InstitutionCoverage1792411000000().up(runner);
  } finally {
    await runner.release();
  }
  const refreshed = (
    await db.query("SELECT * FROM discovered_notice WHERE id=$1", [n.id])
  )[0];
  assert.equal(refreshed.medical_candidate, true);
  assert.equal(refreshed.review_status, "dismissed");
  assert.equal(refreshed.review_reason, "SYNTHETIC operator decision");
  assert.equal(
    new Date(refreshed.last_seen).toISOString(),
    "2026-10-19T00:00:00.000Z",
  );
  const paused = (await db.query("SELECT * FROM source WHERE id='icmr'"))[0];
  assert.equal(paused.enabled, false);
  assert.match(paused.checkpoint, /page=2/);
  const kmscl = (await db.query("SELECT * FROM source WHERE id='kmscl'"))[0];
  assert.equal(kmscl.enabled, true);
  assert.equal(kmscl.checkpoint, null);
  await collection(raipur("SYNTHETIC ELISA kits")).run("aiims-raipur");
  assert.equal(
    (
      await db.query(
        "SELECT review_status FROM discovered_notice WHERE id=$1",
        [n.id],
      )
    )[0].review_status,
    "dismissed",
  );
  assert.equal((await new Analytics(db).overview(f)).tenders, 0);
});
