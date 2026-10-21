import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { Collection } from "../apps/api/src/collection/service";
import { Ingestion } from "../apps/api/src/ingestion";
import { raipur, icmr, cppp } from "./collection-fixtures";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  a = new Analytics(db);
const f = (extra: any = {}) => filterSchema.parse(extra);
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
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = async (html = raipur(), source = "aiims-raipur") =>
  new Collection(db, async () => html, 0).run(source);
const reviewed = (id = "GEM/2026/B/123456") => ({
  sourcePortal: "gem",
  bidNumber: id,
  title: "SYNTHETIC Patient monitor",
  sourceUrl: "https://www.aiimsraipur.edu.in/original.pdf",
  publishedAt: "2026-10-20",
  buyer: { key: "SYNTHETIC", name: "AIIMS Raipur", state: "Chhattisgarh" },
  items: [
    {
      key: "one",
      name: "Patient monitor",
      quantity: "5",
      unit: "pieces",
      evidence: "SYNTHETIC original page 1",
    },
  ],
});
test("new listings appear across main insights immediately without approval or invented quantities", async () => {
  await collect(raipur("SYNTHETIC Patient monitors", "", "GEM/2026/B/123456"));
  const overview = await a.overview(f());
  assert.equal(overview.tenders, 1);
  assert.equal(overview.listing_notices, 1);
  assert.equal(overview.reviewed_tenders, 0);
  const product = (await a.products(f()))[0];
  assert.equal(product.product_id, "patient-monitors");
  assert.equal(product.quantities.unknown, null);
  assert.equal(product.known_value, null);
  assert.equal((await a.states(f()))[0].state, "Chhattisgarh");
  assert.equal((await a.buyers(f()))[0].name, "AIIMS Raipur");
  assert.equal((await a.trends(f()))[0].tenders, 1);
  const row = (await a.tenders(f())).data[0];
  assert.equal(row.evidence_level, "listing");
  assert.equal(row.items[0].quantity, null);
  assert.equal((await a.overview(f({ evidence: "reviewed" }))).tenders, 0);
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "pending",
  );
});
test("GeM originals and amendments across sources are one signal and preserve all source filters", async () => {
  await collect(raipur("SYNTHETIC Lab incubator", "", "GEM/2026/B/123456"));
  await collect(icmr.split('<a rel="next"')[0], "icmr");
  assert.equal((await a.overview(f())).tenders, 1);
  assert.equal((await a.overview(f({ source: "icmr" }))).tenders, 1);
  assert.equal((await a.overview(f({ source: "aiims-raipur" }))).tenders, 1);
  const r = (await db.query("SELECT * FROM insight_record"))[0];
  assert.equal(r.source_observations, 3);
  assert.equal(r.observation_ids.length, 3);
  assert.equal(r.documents.length, 4);
});
test("reviewed item records replace matching listing signals without doubling quantities or frequency", async () => {
  await collect(raipur("SYNTHETIC Patient monitors", "", "GEM/2026/B/123456"));
  await new Ingestion(db).import([reviewed()], "SYNTHETIC reviewed source");
  const overview = await a.overview(f());
  assert.equal(overview.tenders, 1);
  assert.equal(overview.reviewed_tenders, 1);
  assert.equal(overview.listing_notices, 0);
  assert.equal((await a.products(f()))[0].quantities.units, 5);
  assert.equal((await a.overview(f({ source: "aiims-raipur" }))).tenders, 1);
  assert.equal((await a.overview(f({ evidence: "listing" }))).tenders, 0);
  await db.query("UPDATE tender SET status='cancelled'");
  assert.equal((await a.overview(f())).tenders, 0);
  assert.equal((await a.overview(f({ evidence: "listing" }))).tenders, 0);
});
test("native documents sharing a reference remain separate while repeated original URLs group", async () => {
  await collect(raipur("SYNTHETIC Patient monitors", "", "SYNTHETIC/SHARED"));
  await collect(
    raipur("SYNTHETIC Patient monitors", "", "SYNTHETIC/SHARED").replaceAll(
      "synthetic.pdf",
      "different.pdf",
    ),
  );
  assert.equal((await a.overview(f())).tenders, 2);
  await collect(
    raipur("SYNTHETIC Patient monitors", "", "SYNTHETIC/SHARED"),
    "aiims-raipur-quotations",
  );
  assert.equal((await a.overview(f())).tenders, 2);
});
test("CPPP central/state transport links group by their stable reference", async () => {
  await collect(cppp, "cppp");
  await collect(
    cppp
      .replace("Organisation Name", "State Name")
      .replace("TEST Hospital", "Punjab"),
    "cppp-states",
  );
  assert.equal((await a.overview(f())).tenders, 1);
  assert.equal((await a.overview(f({ source: "cppp-states" }))).tenders, 1);
});
test("buyer identities support UUID filters and listing locations never become confirmed deliveries", async () => {
  await collect();
  const buyer = (await a.buyers(f()))[0];
  f({ buyer: buyer.id });
  assert.equal((await a.overview(f({ buyer: buyer.id }))).tenders, 1);
  assert.equal(
    (await a.overview(f({ basis: "delivery", state: "Chhattisgarh" }))).tenders,
    0,
  );
  assert.deepEqual(await a.states(f({ basis: "delivery" })), []);
  assert.equal(
    (await a.overview(f({ from: "2026-10-20", to: "2026-10-20" }))).tenders,
    1,
  );
  assert.equal((await a.overview(f({ from: "2026-10-21" }))).tenders, 0);
});
test("clinical supplies stay visible without a fabricated equipment family; dismissals remain excluded", async () => {
  await collect(raipur("SYNTHETIC Reagents"));
  assert.equal((await a.overview(f({ medical: "true" }))).medical_tenders, 1);
  assert.deepEqual(await a.products(f()), []);
  assert.equal((await a.buyers(f()))[0].products, 0);
  assert.equal(
    (await a.trends(f()))[0].product_name,
    "Other clinical procurement",
  );
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  assert.equal((await a.overview(f())).tenders, 0);
});
