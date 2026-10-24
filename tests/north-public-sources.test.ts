import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { NorthPublicSources1792418000000 } from "../apps/api/src/migrations/north-public-sources";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import {
  parseListing,
  pageAllowed,
  noticeKey,
  noticeClassification,
} from "../apps/api/src/collection/parsers";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import {
  rblCard,
  gkpRow,
  gkpTable,
  healthEmpty,
} from "./north-public-fixtures";
const rbl = getSource("aiims-raebareli"),
  gkp = getSource("aiims-gorakhpur");
test("Raebareli reads explicit GeM references from the separate reference field with original dates and download route", () => {
  const n = parseListing(rblCard(), rbl).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.equal(n.publishedAt, "2026-10-17");
  assert.equal(n.closingDate, "2026-10-30");
  assert.equal(n.state, "Uttar Pradesh");
  assert.deepEqual(n.products, ["ultrasound"]);
  assert.match(n.documents[0], /tender-file-download\/123$/);
  assert.equal(n.key, noticeKey(rbl, n.bidNumber, n.url, n.title));
});
test("Raebareli PAC objection windows are not publication or bid-closing dates and labelled paragraphs retain the source description", () => {
  const n = parseListing(
    rblCard(
      "SYNTHETIC/123",
      "SYNTHETIC Ophthalmology consumables",
      "/pac-file-download/123",
      true,
    ),
    getSource("aiims-raebareli-pac"),
  ).notices[0];
  assert.equal(n.title, "SYNTHETIC Ophthalmology consumables");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.medical, true);
  assert.deepEqual(n.products, []);
});
test("Raebareli missing originals retain distinct title/reference identities rather than treating the listing as an original", () => {
  const p = parseListing(
    rblCard("SYNTHETIC/123", "SYNTHETIC Patient monitors", "") +
      rblCard("SYNTHETIC/123", "SYNTHETIC Syringe pumps", ""),
    rbl,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  assert.ok(
    p.notices.every((n) => n.url === rbl.url && n.documents.length === 0),
  );
});
test("Raebareli follows only advancing positive page numbers within its exact published list", () => {
  const s = getSource("aiims-raebareli-archive"),
    html = rblCard() + '<a rel="next" href="?page=2">Next</a>';
  assert.equal(parseListing(html, s).next, s.url + "?page=2");
  for (const suffix of [
    "?page=0",
    "?page=-1",
    "?page=2&page=3",
    "?page=2&limit=100",
    "?start=20",
  ])
    assert.equal(pageAllowed(s.url + suffix, s), false);
  assert.equal(pageAllowed(rbl.url + "?page=2", s), false);
  assert.throws(
    () => parseListing(html, s, s.url + "?page=2"),
    /Non-advancing/,
  );
  assert.throws(
    () =>
      parseListing(
        html.replace("?page=2", "https://outside.example/?page=2"),
        s,
      ),
    /Unsupported pagination/,
  );
});
test("Raebareli's explicitly disabled final Next link ends a list while active JavaScript links fail visibly", () => {
  const html =
    rblCard() +
    '<li aria-disabled="true"><a aria-hidden="true" href="javascript:void(0);">Next</a></li>';
  assert.equal(parseListing(html, rbl).next, null);
  assert.equal(parseListing(html, rbl).notices.length, 1);
  assert.throws(
    () => parseListing(html.replace('aria-disabled="true"', ""), rbl),
    /Unsupported pagination/,
  );
});
test("Raebareli malformed access/layout responses and unlabelled references fail visibly", () => {
  for (const html of [
    "<h1>Unavailable</h1>",
    rblCard().replace("Ref./Adv. Number:", "Unexpected field:"),
    rblCard().replace("<p>SYNTHETIC Advanced USG machine</p>", ""),
  ])
    assert.throws(() => parseListing(html, rbl), /missing|lacks/);
});
test("Gorakhpur ignores hidden date sort keys and filename numbers; original and amendment links are retained", () => {
  const html = gkpTable(
    gkpRow("SYNTHETIC Patient monitors", "/GeM-Bidding-123456.pdf").replace(
      "</td><td>",
      '<a href="/amendment.pdf">Amendment</a></td><td>',
    ),
  );
  const n = parseListing(html, gkp).notices[0];
  assert.equal(n.bidNumber, null);
  assert.equal(n.portal, "institution");
  assert.equal(n.documents.length, 2);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal("quantity" in n, false);
  assert.deepEqual(n.products, ["patient-monitors"]);
});
test("Gorakhpur missing headings can use meaningful published link labels but generic download labels fail", () => {
  const n = parseListing(
    gkpTable(
      gkpRow(
        "",
        "/original.pdf",
        "SYNTHETIC Expression of interest for ATM installation",
      ),
    ),
    gkp,
  ).notices[0];
  assert.match(n.title, /Expression of interest/);
  assert.equal(n.medical, false);
  assert.throws(
    () => parseListing(gkpTable(gkpRow("", "/original.pdf", "Download")), gkp),
    /row changed/,
  );
});
test("Gorakhpur reused PDFs preserve conflicting title contexts and strict query/layout guards", () => {
  const p = parseListing(
    gkpTable(gkpRow() + gkpRow("SYNTHETIC Syringe pumps")),
    gkp,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  assert.equal(pageAllowed(gkp.url + "?page=2", gkp), false);
  assert.throws(
    () =>
      parseListing(
        gkpTable().replace("</td></tr>", "</td><td>EXTRA</td></tr>"),
        gkp,
      ),
    /row changed/,
  );
  assert.throws(
    () => parseListing("<h1>Archived Tenders</h1>", gkp),
    /table missing/,
  );
});
test("Uttarakhand accepts the publisher's explicit empty state, while blank or unrelated pages remain failures", () => {
  const s = getSource("uttarakhand-health");
  assert.deepEqual(parseListing(healthEmpty, s), { notices: [], next: null });
  assert.deepEqual(
    parseListing(
      healthEmpty.replace("<h1>Tenders", "<h1>Past Tenders"),
      getSource("uttarakhand-health-archive"),
    ),
    { notices: [], next: null },
  );
  for (const html of [
    "<h1>Tenders</h1>",
    healthEmpty.replace('id="no-results-message"', 'class="unrelated"'),
    healthEmpty.replace("<h1>Tenders", "<h1>Recruitments"),
  ])
    assert.throws(() => parseListing(html, s), /table missing/);
});
test("new clinical descriptions remain medical without inventing equipment families, while electrical works do not become equipment purchases", () => {
  for (const title of [
    "SYNTHETIC Ophthalmology consumables",
    "SYNTHETIC procurement for Gynecology",
    "SYNTHETIC Paediatric care",
    "SYNTHETIC Total Parenteral Nutrition solution",
    "SYNTHETIC Cholecalciferol granules",
  ]) {
    const n = noticeClassification(title);
    assert.equal(n.medical, true, title);
    assert.deepEqual(n.products, [], title);
  }
  for (const title of [
    "SYNTHETIC Supply 3 phase power to the UPS Room Near Cath Lab",
    "SYNTHETIC Electrical wiring for UPS in MRI",
  ]) {
    const n = noticeClassification(title);
    assert.equal(n.medical, true);
    assert.deepEqual(n.products, []);
  }
  assert.deepEqual(
    noticeClassification("SYNTHETIC Supply of MRI machine").products,
    ["mri"],
  );
});
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  a = new Analytics(db),
  f = filterSchema.parse({ medical: "true" });
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.transaction((q) => new NorthPublicSources1792418000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (id: string, html: string, budget = 25) =>
  new Collection(db, async () => html, 0, budget).run(id);
test("Raebareli current-to-archive movement groups native download routes and adds publication trends without quantities", async () => {
  const html = rblCard("SYNTHETIC/RBL/123");
  await collect(rbl.id, html);
  await collect("aiims-raebareli-archive", html);
  const o = await a.overview(f);
  assert.equal(o.tenders, 1);
  assert.equal(o.undated_tenders, 0);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
    2,
  );
  assert.ok((await a.trends(f)).length);
  assert.ok(
    (await a.products(f)).every((p) =>
      Object.values(p.quantities || {}).every((v) => v === null),
    ),
  );
  assert.deepEqual(
    await a.states(filterSchema.parse({ medical: "true", basis: "delivery" })),
    [],
  );
});
test("Gorakhpur conflicting documents remain separate while explicit GeM references still group across profiles", async () => {
  await collect(gkp.id, gkpTable(gkpRow() + gkpRow("SYNTHETIC Syringe pumps")));
  assert.equal((await a.overview(f)).tenders, 2);
  await db.query("TRUNCATE discovered_notice,collection_run CASCADE");
  await collect(
    gkp.id,
    gkpTable(gkpRow("SYNTHETIC GEM/2026/B/123456 Patient monitors")),
  );
  await collect(
    "aiims-gorakhpur-quotations",
    gkpTable(
      gkpRow(
        "SYNTHETIC GEM/2026/B/123456 Updated patient monitors",
        "/amendment.pdf",
      ),
    ),
  );
  assert.equal((await a.overview(f)).tenders, 1);
});
test("an explicit empty health list records successful zero discovery without deleting earlier evidence", async () => {
  const s = getSource("uttarakhand-health");
  await collect(gkp.id, gkpTable());
  await collect(s.id, healthEmpty);
  assert.equal(
    (
      await db.query("SELECT status FROM collection_run WHERE source_id=$1", [
        s.id,
      ])
    )[0].status,
    "succeeded",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
    1,
  );
  const summary = await new Collection(db).summary();
  assert.equal(summary.nationalCompleteness, null);
  assert.equal(
    summary.sources.find((s: any) => s.id === "uttarakhand-health").notices,
    0,
  );
});
test("new-source migration preserves local pauses, checkpoints, reviews, observation age and customized product names/aliases", async () => {
  await collect(
    rbl.id,
    rblCard("SYNTHETIC/123", "SYNTHETIC Gynecology consumables"),
  );
  await db.query(
    "UPDATE discovered_notice SET review_status='dismissed',first_seen='2020-01-01',last_seen='2020-01-02'",
  );
  await db.query(
    "UPDATE source SET enabled=false,checkpoint=$1 WHERE id='aiims-raebareli-archive'",
    [getSource("aiims-raebareli-archive").url + "?page=26"],
  );
  const before = await db.query(
    "SELECT id,review_status,first_seen,last_seen FROM discovered_notice",
  );
  const [old] = await db.query(
    "SELECT name,aliases FROM product WHERE id='ultrasound'",
  );
  try {
    await db.query(
      "UPDATE product SET name='SYNTHETIC local name',aliases='[\"SYNTHETIC local alias\"]' WHERE id='ultrasound'",
    );
    await db.transaction((q) => new NorthPublicSources1792418000000().up(q));
    await db.transaction((q) => new NorthPublicSources1792418000000().up(q));
    assert.deepEqual(
      await db.query(
        "SELECT id,review_status,first_seen,last_seen FROM discovered_notice",
      ),
      before,
    );
    const [s] = await db.query(
      "SELECT enabled,checkpoint FROM source WHERE id='aiims-raebareli-archive'",
    );
    assert.equal(s.enabled, false);
    assert.match(s.checkpoint, /page=26$/);
    const [p] = await db.query(
      "SELECT name,aliases FROM product WHERE id='ultrasound'",
    );
    assert.equal(p.name, "SYNTHETIC local name");
    assert.deepEqual(p.aliases, ["SYNTHETIC local alias", "usg machine"]);
  } finally {
    await db.query(
      "UPDATE product SET name=$1,aliases=$2 WHERE id='ultrasound'",
      [old.name, JSON.stringify(old.aliases)],
    );
  }
});
test("North bulk queue includes the eleven new profiles and keeps unresolved sources disabled", async () => {
  const old = process.env.COLLECTION_REGION;
  process.env.COLLECTION_REGION = "north";
  try {
    assert.equal(SOURCES.filter((s) => s.adapter).length, 65);
    assert.equal(SOURCES.length, 117);
    assert.equal((await new Collection(db).queue()).queued, 49);
    for (const id of ["safdarjung", "pgimer", "aiims-gorakhpur-archive"])
      assert.equal(
        (await db.query("SELECT enabled FROM source WHERE id=$1", [id]))[0]
          .enabled,
        false,
      );
  } finally {
    if (old == null) delete process.env.COLLECTION_REGION;
    else process.env.COLLECTION_REGION = old;
  }
});
