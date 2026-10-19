import "reflect-metadata";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { Initial1792400000000 } from "../apps/api/src/migrations/initial";
import { Ingestion } from "../apps/api/src/ingestion";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to an isolated database ending in _test. Production databases are never used for tests.",
  );
const db = new DataSource({
  type: "postgres",
  url,
  migrations: [Initial1792400000000],
  synchronize: false,
});
const ingest = new Ingestion(db),
  a = new Analytics(db);
const f = (extra: any = {}) => filterSchema.parse(extra);
const bid = (
  id = "10001",
  items: any[] = [
    {
      key: "monitor",
      name: "Patient monitor",
      quantity: "100",
      unit: "pieces",
      evidence: "TEST ONLY - NOT REAL PROCUREMENT",
      destinations: [
        {
          state: "Punjab",
          district: "Mohali",
          confirmed: true,
          quantity: "60",
          evidence: "TEST ONLY",
        },
        {
          state: "Haryana",
          district: "Panchkula",
          confirmed: true,
          quantity: "40",
          evidence: "TEST ONLY",
        },
      ],
    },
  ],
) => ({
  bidNumber: "GEM/2026/B/" + id,
  title: "SYNTHETIC TEST FIXTURE ONLY",
  sourceUrl: "https://example.org/test",
  publishedAt: "2026-10-01",
  buyer: {
    key: "TEST-HOSPITAL-1",
    name: "Synthetic test institution",
    state: "Delhi",
    district: "Delhi",
  },
  estimatedValue: null,
  items,
});
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
});
test("one tender with three product families counts once overall", async () => {
  await ingest.import(
    [
      bid("10001", [
        {
          key: "a",
          name: "Patient monitor",
          quantity: "10",
          unit: "pieces",
          evidence: "TEST",
        },
        {
          key: "b",
          name: "ICU ventilator",
          quantity: "2",
          unit: "pieces",
          evidence: "TEST",
        },
        {
          key: "c",
          name: "Ultrasound machine",
          quantity: "1",
          unit: "pieces",
          evidence: "TEST",
        },
      ]),
    ],
    "TEST FIXTURE ONLY",
  );
  assert.equal((await a.overview(f())).tenders, 1);
  const p = await a.products(f());
  assert.equal(p.length, 3);
  assert.equal(
    p.reduce((s: any, r: any) => s + r.tenders, 0),
    3,
  );
});
test("duplicate imports do not increase tender counts, units or versions", async () => {
  await ingest.import([bid()], "TEST FIXTURE ONLY");
  const r = await ingest.import([bid()], "TEST REIMPORT");
  assert.equal(r.unchanged, 1);
  assert.equal((await a.overview(f())).tenders, 1);
  assert.equal((await a.products(f()))[0].quantities.units, 100);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM tender_version"))[0].n,
    1,
  );
});
test("amendment replaces current units and retains source history", async () => {
  const b = bid();
  await ingest.import([b], "TEST ORIGINAL");
  b.items[0].quantity = "120";
  b.items[0].destinations = [];
  await ingest.import([b], "TEST AMENDMENT");
  assert.equal((await a.products(f()))[0].quantities.units, 120);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM tender_version"))[0].n,
    2,
  );
});
test("manual classification survives amended import", async () => {
  const b = bid();
  await ingest.import([b], "TEST ORIGINAL");
  const li = (await db.query("SELECT id FROM line_item"))[0];
  await ingest.correct(li.id, "icu-ventilators", "TEST correction retained");
  b.title = "TEST CHANGED";
  await ingest.import([b], "TEST AMENDED");
  assert.equal((await a.products(f()))[0].product_id, "icu-ventilators");
  assert.equal((await a.overview(f())).tenders, 1);
});
test("hospital civil works do not contribute equipment demand", async () => {
  await ingest.import(
    [
      bid("10002", [
        {
          key: "civil",
          name: "Civil repair of anaesthesia room",
          quantity: "1",
          unit: "job",
          evidence: "TEST ONLY",
        },
      ]),
    ],
    "TEST CIVIL",
  );
  assert.equal((await a.overview(f())).medical_tenders, 0);
  assert.equal((await a.products(f())).length, 0);
  assert.equal((await a.overview(f())).tenders, 1);
});
test("missing values remain null; EMD does not become procurement estimate", async () => {
  await ingest.import([{ ...bid(), emd: "100000" }], "TEST MISSING");
  assert.equal((await a.overview(f())).known_value, null);
  assert.equal((await a.products(f()))[0].known_value, null);
});
test("equal tender values are each counted, not SUM DISTINCT value", async () => {
  await ingest.import(
    [
      { ...bid("10001"), estimatedValue: "500" },
      { ...bid("10002"), estimatedValue: "500" },
    ],
    "TEST VALUES",
  );
  assert.equal((await a.overview(f())).known_value, "1000.00");
});
test("buyer and delivery states are distinct; allocation never duplicates full quantity", async () => {
  await ingest.import([bid()], "TEST LOCATIONS");
  assert.equal((await a.states(f()))[0].state, "Delhi");
  const s = await a.states(f({ basis: "delivery" }));
  assert.equal(s.find((x: any) => x.state === "Punjab").quantities.units, 60);
  assert.equal(s.find((x: any) => x.state === "Haryana").quantities.units, 40);
  assert.equal(
    (await a.products(f({ basis: "delivery", state: "Punjab" })))[0].quantities
      .units,
    60,
  );
  assert.equal(
    (await a.overview(f({ basis: "delivery", state: "Punjab" }))).tenders,
    1,
  );
  assert.equal(
    (await a.tenders(f({ basis: "delivery", state: "Punjab" }))).total,
    1,
  );
});
test("unknown destination allocations remain unknown instead of equal splitting", async () => {
  const b = bid();
  b.items[0].destinations.forEach((x: any) => (x.quantity = null));
  await ingest.import([b], "TEST UNALLOCATED");
  const s = await a.states(f({ basis: "delivery" }));
  assert.equal(s[0].quantities.units, null);
});
test("inferred delivery locations are excluded", async () => {
  const b = bid();
  b.items[0].destinations.forEach((x: any) => (x.confirmed = false));
  await ingest.import([b], "TEST INFERRED");
  assert.equal((await a.states(f({ basis: "delivery" }))).length, 0);
  assert.equal(
    (await a.products(f({ basis: "delivery", state: "Punjab" }))).length,
    0,
  );
});
test("unknown publication is excluded from trends, not replaced with closure", async () => {
  await ingest.import(
    [{ ...bid(), publishedAt: null, closesAt: "2026-10-20T12:00:00+05:30" }],
    "TEST UNDATED",
  );
  assert.equal((await a.trends(f())).length, 0);
  assert.equal((await a.overview(f())).undated_tenders, 1);
});
test("historical queries use publication dates and preserve unknown gaps", async () => {
  await ingest.import([bid()], "TEST DATED");
  const r = await a.trends(f());
  assert.equal(r.length, 1);
  assert.equal(r[0].period, "2026-10-01");
  assert.equal(r[0].tenders, 1);
  assert.equal((await a.trends(f({ from: "2026-11-01" }))).length, 0);
});
test("financial years begin in April", async () => {
  await ingest.import([{ ...bid(), publishedAt: "2026-03-31" }], "TEST FY");
  assert.equal(
    (await a.trends(f({ bucket: "financial_year" })))[0].period,
    "2025-2026",
  );
});
test("units remain separated for kits and pieces", async () => {
  await ingest.import(
    [
      bid("10001", [
        {
          key: "one",
          name: "Patient monitor",
          quantity: "10",
          unit: "pieces",
          evidence: "TEST",
        },
        {
          key: "two",
          name: "Patient monitor",
          quantity: "2",
          unit: "sets",
          evidence: "TEST",
        },
      ]),
    ],
    "TEST UNITS",
  );
  const r = (await a.products(f()))[0];
  assert.deepEqual(r.quantities, { units: 10, sets: 2 });
});
test("invalid batch rolls back every bid and records failure", async () => {
  await assert.rejects(
    ingest.import(
      [
        bid(),
        {
          ...bid("10002"),
          buyer: { key: "bad", name: "bad", state: "Not a state" },
        },
      ],
      "TEST BAD",
    ),
  );
  assert.equal((await a.overview(f())).tenders, 0);
  assert.equal(
    (await db.query("SELECT status FROM collection_run"))[0].status,
    "failed",
  );
});
test("duplicate bid keys within one batch are rejected", async () => {
  await assert.rejects(ingest.import([bid(), bid()], "TEST DUPLICATE BATCH"));
  assert.equal((await a.overview(f())).tenders, 0);
});
test("filters and pagination apply to database results", async () => {
  await ingest.import([bid("10001"), bid("10002")], "TEST PAGE");
  assert.equal((await a.tenders(f({ limit: 1, page: 2 }))).data.length, 1);
  assert.equal((await a.tenders(f({ limit: 1, page: 2 }))).total, 2);
  assert.equal((await a.products(f({ state: "Punjab" }))).length, 0);
  assert.equal((await a.products(f({ state: "Delhi" }))).length, 1);
  assert.throws(() => f({ limit: 500 }));
  assert.throws(() => f({ from: "2026-12-01", to: "2026-01-01" }));
});
test("category totals and filters use unique tender identities", async () => {
  await ingest.import([bid()], "TEST CATEGORY");
  assert.equal(
    (await a.categories(f())).find((c: any) => c.id === "critical-care")
      .tenders,
    1,
  );
  assert.equal((await a.products(f({ category: "medical" }))).length, 1);
  assert.equal(
    (await a.products(f({ category: "diagnostic-imaging" }))).length,
    0,
  );
});
test("stale source revisions cannot overwrite newer observations", async () => {
  await ingest.import(
    [{ ...bid(), revisionAt: "2026-10-15T00:00:00Z" }],
    "TEST NEWER",
  );
  await assert.rejects(
    ingest.import(
      [{ ...bid(), revisionAt: "2026-10-01T00:00:00Z", title: "STALE TEST" }],
      "TEST STALE",
    ),
  );
});
test("genuine re-tenders remain separate linked notices", async () => {
  await ingest.import(
    [bid("10001"), { ...bid("10002"), relatedBidNumber: "GEM/2026/B/10001" }],
    "TEST RETENDER",
  );
  assert.equal((await a.overview(f())).tenders, 2);
});
test("no fabricated percentage when prior-period baseline is absent", async () => {
  await ingest.import([bid()], "TEST GROWTH");
  const r = await a.growth(f({ from: "2026-10-01", to: "2026-10-31" }));
  assert.equal(r.coverageComparable, false);
  assert.equal(r.products[0].growth.percent, null);
});
test("cancelled notices are retained and excluded by default", async () => {
  await ingest.import([{ ...bid(), status: "cancelled" }], "TEST CANCELLED");
  assert.equal((await a.overview(f())).tenders, 0);
  assert.equal((await a.overview(f({ status: "cancelled" }))).tenders, 1);
});

test("selected delivery district is applied to every destination breakdown", async () => {
  const b = bid();
  b.items[0].destinations = [
    {
      state: "Punjab",
      district: "Mohali",
      confirmed: true,
      quantity: "60",
      evidence: "TEST ONLY",
    },
    {
      state: "Punjab",
      district: "Ludhiana",
      confirmed: true,
      quantity: "40",
      evidence: "TEST ONLY",
    },
  ];
  await ingest.import([b], "TEST DISTRICT FILTER");
  const r = await a.districts(
    f({ basis: "delivery", state: "Punjab", district: "Mohali" }),
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].district, "Mohali");
  assert.equal(
    (
      await a.products(
        f({ basis: "delivery", state: "Punjab", district: "Mohali" }),
      )
    )[0].quantities.units,
    60,
  );
});
