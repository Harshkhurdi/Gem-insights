import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { AiimsCoverage1792413000000 } from "../apps/api/src/migrations/aiims-coverage";
import {
  parseListing,
  pageAllowed,
  noticeKey,
  noticeClassification,
} from "../apps/api/src/collection/parsers";
import { getSource } from "../apps/api/src/collection/registry";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { delhiTable, bathindaTable, bathindaRow } from "./aiims-fixtures";
import { digest } from "../packages/core/domain";
const delhi = getSource("aiims-delhi"),
  archive = getSource("aiims-delhi-archive-open"),
  bathinda = getSource("aiims-bathinda");

test("clinical title recall includes specialty supplies without inventing equipment families or quantities", () => {
  for (const title of [
    "SYNTHETIC Single Chamber Pacemaker",
    "SYNTHETIC Chest Binder for patient care",
    "SYNTHETIC Dysphagia Treatment",
    "SYNTHETIC Pulse Oximeter Probe (Neonatal)",
    "SYNTHETIC Injection Cisplatin",
    "SYNTHETIC Molecular Biology Kits",
    "SYNTHETIC Scrub Suit",
  ]) {
    assert.equal(noticeClassification(title).medical, true, title);
  }
  assert.deepEqual(
    noticeClassification("SYNTHETIC Single Chamber Pacemaker").products,
    [],
  );
  assert.equal(noticeClassification("SYNTHETIC Office chairs").medical, false);
});

test("Delhi current listings retain explicit publication and GeM/CPPP references without taking the row number as a reference", () => {
  for (const [title, ref, portal] of [
    [
      "SYNTHETIC Patient monitors GEM /2026/B/123456",
      "GEM/2026/B/123456",
      "gem",
    ],
    [
      "SYNTHETIC Microscope CPP Portal tender ID: 2026_AIMSD_123456_1",
      "2026_AIMSD_123456_1",
      "institution",
    ],
    ["SYNTHETIC Reagents", null, "institution"],
  ]) {
    const n = parseListing(delhiTable(title!), delhi).notices[0];
    assert.equal(n.bidNumber, ref);
    assert.equal(n.portal, portal);
    assert.equal(n.publishedAt, "2026-10-20");
    assert.equal(n.closingDate, "2026-11-05");
    assert.equal(n.buyer, "AIIMS New Delhi");
    assert.equal(n.state, "Delhi");
    assert.equal("quantity" in n, false);
  }
});
test("Delhi archive opening dates are not publication and original expired-article URLs are retained", () => {
  const p = parseListing(
    delhiTable(undefined, undefined, true, "?start=10"),
    archive,
  );
  assert.equal(p.notices[0].publishedAt, null);
  assert.equal(p.notices[0].closingDate, "2026-11-05");
  assert.match(p.notices[0].url, /view=expire&id=12345:synthetic&catid=133$/);
  assert.equal(p.next, archive.url + "?start=10");
});
test("archive pagination cannot switch category, enter a detail article, leave the official host or rewind offsets", () => {
  for (const next of [
    "?start=0",
    "?start=1&start=10",
    "?id=12345",
    "?view=expire&start=10",
    "?start=-10",
    "https://example.com/?start=10",
    getSource("aiims-delhi-archive-limited").url,
  ]) {
    assert.equal(
      pageAllowed(next.startsWith("?") ? archive.url + next : next, archive),
      next === "?start=0",
    );
    assert.throws(
      () => parseListing(delhiTable(undefined, undefined, true, next), archive),
      /pagination|offset/,
    );
  }
  assert.throws(
    () =>
      parseListing(
        delhiTable(undefined, undefined, true, "?start=10"),
        archive,
        archive.url + "?start=20",
      ),
    /offset/,
  );
});
test("Delhi rejects missing tables and external detail links rather than marking a broken layout successful", () => {
  assert.throws(
    () => parseListing("<h1>Tenders temporarily unavailable</h1>", delhi),
    /table missing/,
  );
  assert.throws(
    () =>
      parseListing(
        delhiTable().replace(
          "/index.php/en/tenders?id=12345",
          "https://example.com/article",
        ),
        delhi,
      ),
    /official detail link/,
  );
});
test("Delhi strips named EHS beneficiary details while retaining the procurement description and official link", () => {
  const n = parseListing(
    delhiTable(
      "SYNTHETIC Device for EHS beneficiary Mr. Synthetic Person (EHS no.- 1234) under PAC",
    ),
    delhi,
  ).notices[0];
  assert.equal(n.title, "SYNTHETIC Device for an EHS beneficiary under PAC");
  assert.doesNotMatch(JSON.stringify(n), /Synthetic Person|1234\)/);
});
test("Bathinda prefers original documents, keeps amendments/BOQs, and does not turn Start Date into publication", () => {
  const n = parseListing(bathindaTable(), bathinda).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.match(n.url, /original.pdf$/);
  assert.equal(n.documents.length, 3);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-05");
  assert.equal(n.buyer, "AIIMS Bathinda");
  assert.equal(n.state, "Punjab");
  assert.equal("quantity" in n, false);
});
test("Bathinda rows without usable attachments remain separate and restorable; categories cannot be swapped by pagination", () => {
  const p = parseListing(
    bathindaTable(
      bathindaRow("SYNTHETIC/SHARED", "SYNTHETIC Reagents", "") +
        bathindaRow(
          "SYNTHETIC/SHARED",
          "SYNTHETIC Catheters",
          '<a href="javascript:download()">Download</a>',
        ),
    ),
    bathinda,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  for (const n of p.notices) {
    assert.equal(n.url, bathinda.url);
    assert.equal(n.key, noticeKey(bathinda, n.bidNumber, n.url, n.title));
  }
  assert.equal(pageAllowed(bathinda.url, bathinda), true);
  assert.equal(
    pageAllowed(
      "https://aiimsbathinda.edu.in/Procurements.aspx?other=category",
      bathinda,
    ),
    false,
  );
});

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  analytics = new Analytics(db);
const f = (extra: any = {}) =>
  filterSchema.parse({ medical: "true", ...extra });
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
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL,next_collection_at=now(),last_error=NULL",
  );
});
const collect = (html: string, id: string) =>
  new Collection(db, async () => html, 0).run(id);
test("Delhi current/archive copies of the same article count once in main insights and preserve both source filters", async () => {
  await collect(delhiTable(), delhi.id);
  await collect(delhiTable(undefined, undefined, true), archive.id);
  assert.equal((await analytics.overview(f())).tenders, 1);
  for (const source of [delhi.id, archive.id])
    assert.equal((await analytics.overview(f({ source }))).tenders, 1);
  const [r] = await db.query("SELECT * FROM insight_record");
  assert.equal(r.identity, "aiims-delhi:article:12345");
  assert.equal(r.source_observations, 2);
  assert.equal((await analytics.products(f()))[0].quantities.unknown, null);
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
  assert.deepEqual(await analytics.states(f({ basis: "delivery" })), []);
  await collect(delhiTable(undefined, "12346"), delhi.id);
  assert.equal((await analytics.overview(f())).tenders, 2);
});
test("explicit GeM references group Delhi and Bathinda notices across institutions while keeping conflicting publisher locations unknown", async () => {
  await collect(
    delhiTable("SYNTHETIC Patient monitors GEM/2026/B/123456"),
    delhi.id,
  );
  await collect(bathindaTable(), bathinda.id);
  const [r] = await db.query("SELECT * FROM insight_record");
  assert.equal(r.identity, "gem:GEM/2026/B/123456");
  assert.equal(r.source_observations, 2);
  assert.equal(r.buyer_name, null);
  assert.equal(r.buyer_state, null);
  assert.equal((await analytics.overview(f())).tenders, 1);
});
test("clinical recall upgrade refreshes older labels without resetting decisions or observation timestamps", async () => {
  const html = bathindaTable(
    bathindaRow("SYNTHETIC/PACEMAKER", "SYNTHETIC Single Chamber Pacemaker"),
  );
  await collect(html, bathinda.id);
  const [n] = await db.query("SELECT * FROM discovered_notice");
  const raw = {
    ...n.raw,
    medical: false,
    reason: "SYNTHETIC old classification",
  };
  await db.query(
    "UPDATE discovered_notice SET raw=$2,current_hash=$3,medical_candidate=false,review_status='dismissed',last_seen='2026-10-19T00:00:00Z' WHERE id=$1",
    [n.id, JSON.stringify(raw), digest(raw)],
  );
  await db.transaction((q) => new AiimsCoverage1792413000000().up(q));
  const [updated] = await db.query("SELECT * FROM discovered_notice");
  assert.equal(updated.medical_candidate, true);
  assert.equal(updated.review_status, "dismissed");
  assert.equal(
    new Date(updated.last_seen).toISOString(),
    "2026-10-19T00:00:00.000Z",
  );
  await collect(html, bathinda.id);
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
});
test("new AIIMS archives save bounded backfill offsets and refresh the current archive head without rewinding", async () => {
  const requested: string[] = [];
  const c = new Collection(
    db,
    async (u) => {
      requested.push(u);
      return delhiTable(
        undefined,
        u.includes("start=50") ? "12346" : "12345",
        true,
        u.includes("start=50") ? "?start=60" : "?start=10",
      );
    },
    0,
    2,
  );
  await db.query("UPDATE source SET checkpoint=$2 WHERE id=$1", [
    archive.id,
    archive.url + "?start=50",
  ]);
  await c.run(archive.id);
  assert.deepEqual(requested, [archive.url, archive.url + "?start=50"]);
  assert.equal(
    (
      await db.query("SELECT checkpoint FROM source WHERE id=$1", [archive.id])
    )[0].checkpoint,
    archive.url + "?start=60",
  );
});
test("AIIMS upgrade enables newly implemented sources, preserves pauses and review decisions, and resets only changed listing checkpoints", async () => {
  await collect(bathindaTable(), bathinda.id);
  await db.query(
    "UPDATE discovered_notice SET review_status='dismissed',review_reason='SYNTHETIC decision'",
  );
  await db.query(
    "UPDATE source SET adapter=NULL,enabled=false,listing_url='https://tenders.aiims.edu/',checkpoint='https://tenders.aiims.edu/old' WHERE id='aiims-delhi'",
  );
  await db.query("UPDATE source SET enabled=false,checkpoint=$2 WHERE id=$1", [
    archive.id,
    archive.url + "?start=50",
  ]);
  await db.transaction((q) => new AiimsCoverage1792413000000().up(q));
  const [d] = await db.query("SELECT * FROM source WHERE id='aiims-delhi'");
  assert.equal(d.enabled, true);
  assert.equal(d.checkpoint, null);
  const [a] = await db.query("SELECT * FROM source WHERE id=$1", [archive.id]);
  assert.equal(a.enabled, false);
  assert.equal(a.checkpoint, archive.url + "?start=50");
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
  assert.equal((await analytics.overview(f())).tenders, 0);
});
