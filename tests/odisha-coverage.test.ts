import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { OdishaCoverage1792415000000 } from "../apps/api/src/migrations/odisha-coverage";
import {
  parseListing,
  pageAllowed,
  noticeKey,
} from "../apps/api/src/collection/parsers";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
const current = getSource("aiims-bhubaneswar"),
  archive = getSource("aiims-bhubaneswar-archive");
const link = (file: string) =>
  `<a href="/wp-content/uploads/2026/10/${file}"><img alt="Download PDF"></a>`;
const row = (
  title = "SYNTHETIC Patient monitors",
  original = link("original.pdf"),
  extra = "",
  published = "17-10-2026",
  closing = "07-11-2026",
) =>
  `<tr><td>1</td><td>${title}</td><td>${published}</td><td>${closing}</td><td>${original}</td><td>${extra}</td><td>${link("cancellation.pdf")}</td><td>${link("award.pdf")}</td></tr>`;
const table = (rows = row()) =>
  `<table><tr><th>Sl. No.</th><th>Title</th><th>Publishing Date</th><th>Closing Date</th><th>Download</th><th>Corrigendum</th><th>Cancellation</th><th>Award of Contract</th></tr>${rows}</table>`;
test("Bhubaneswar retains explicit publication/closing dates and all original/amendment/cancellation/award evidence", () => {
  for (const s of [current, archive]) {
    const [n] = parseListing(
      table(row(undefined, undefined, link("corrigendum.pdf"))),
      s,
    ).notices;
    assert.equal(n.publishedAt, "2026-10-17");
    assert.equal(n.closingDate, "2026-11-07");
    assert.match(n.url, /original.pdf$/);
    assert.equal(n.documents.length, 4);
    assert.equal(n.buyer, "AIIMS Bhubaneswar");
    assert.equal(n.state, "Odisha");
    assert.ok(n.products.includes("patient-monitors"));
    assert.equal("quantity" in n, false);
    assert.equal("status" in n, false);
  }
});
test("GeM filename numbers and title quantities do not fabricate complete bid references or item quantities", () => {
  const [n] = parseListing(
    table(
      row(
        "SYNTHETIC GeM procurement of 12 Nos. Syringe Infusion Pump",
        link("GeM-Bidding-9980442.pdf"),
      ),
    ),
    current,
  ).notices;
  assert.equal(n.bidNumber, null);
  assert.equal(n.portal, "institution");
  assert.equal("quantity" in n, false);
  const [explicit] = parseListing(
    table(row("SYNTHETIC Patient monitors GEM / 2026 / B / 123456")),
    current,
  ).notices;
  assert.equal(explicit.bidNumber, "GEM/2026/B/123456");
  assert.equal(explicit.portal, "gem");
});
test("missing original links retain the source list and stable distinct identities even when amendments change", () => {
  const first = parseListing(
    table(
      row(undefined, "", link("corrigendum.pdf")) +
        row("SYNTHETIC Catheters", ""),
    ),
    current,
  ).notices;
  assert.equal(first.length, 2);
  assert.notEqual(first[0].key, first[1].key);
  const [changed] = parseListing(
    table(row(undefined, "", link("new-corrigendum.pdf"))),
    current,
  ).notices;
  assert.equal(first[0].key, changed.key);
  assert.equal(changed.url, current.url);
  assert.equal(
    changed.key,
    noticeKey(current, null, changed.url, changed.title),
  );
  assert.equal(changed.documents.length, 3);
});
test("duplicate original rows retain one observation and malformed dates remain unknown", () => {
  const p = parseListing(table(row() + row()), current);
  assert.equal(p.notices.length, 1);
  const [n] = parseListing(
    table(row(undefined, undefined, "", "31-02-2026", "not available")),
    current,
  ).notices;
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
});
test("layout changes and unsupported category/pagination changes fail visibly; explicit empty pages are allowed", () => {
  assert.throws(
    () => parseListing("<h1>Unavailable</h1>", current),
    /table missing/,
  );
  assert.throws(
    () =>
      parseListing(
        table("<tr><td>1</td><td>SYNTHETIC Patient monitors</td></tr>"),
        current,
      ),
    /eight columns/,
  );
  assert.equal(
    parseListing(
      table('<tr><td colspan="8">No tenders available</td></tr>'),
      current,
    ).notices.length,
    0,
  );
  assert.equal(pageAllowed(current.url, current), true);
  for (const u of [
    archive.url,
    current.url + "?page=2",
    current.url.replace("https:", "http:"),
    current.url.replace("aiimsbhubaneswar", "other"),
  ])
    assert.equal(pageAllowed(u, current), false);
  assert.throws(
    () =>
      parseListing(table() + '<a rel="next" href="?page=2">Next</a>', current),
    /pagination/,
  );
});
test("historical documents with missing source titles remain explicit unclassified evidence", () => {
  const [n] = parseListing(table(row("")), archive).notices;
  assert.equal(n.title, "Untitled procurement notice (source title missing)");
  assert.equal(n.medical, false);
  assert.deepEqual(n.products, []);
  assert.match(n.url, /original.pdf$/);
});
test("registry includes two Odisha profiles with the same publisher", () => {
  assert.equal(SOURCES.filter((s) => s.adapter).length, 64);
  assert.equal(SOURCES.length, 114);
  assert.equal(current.buyerName, archive.buyerName);
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
const collect = (html: string, id = current.id) =>
  new Collection(db, async () => html, 0).run(id);
test("current/archive observations of the same original group once in main insights with unknown quantities", async () => {
  await collect(table());
  await collect(table(), archive.id);
  const o = await analytics.overview(f());
  assert.equal(o.tenders, 1);
  assert.equal(o.known_value, null);
  const [r] = await db.query("SELECT * FROM insight_record");
  assert.equal(r.source_observations, 2);
  assert.equal(r.buyer_name, "AIIMS Bhubaneswar");
  assert.equal(r.buyer_state, "Odisha");
  assert.deepEqual(await analytics.states(f({ basis: "delivery" })), []);
  assert.equal((await analytics.trends(f()))[0].product_id, "patient-monitors");
  assert.ok(
    (await analytics.products(f())).every((p: any) =>
      Object.values(p.quantities).every((v) => v === null),
    ),
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
});
test("unchanged collection preserves review decisions and new cancellation evidence updates the existing observation", async () => {
  await collect(table());
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await collect(table());
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
  await collect(table(row(undefined, undefined, link("new-corrigendum.pdf"))));
  const rows = await db.query("SELECT * FROM discovered_notice");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].review_status, "pending");
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM notice_observation"))[0].n,
    2,
  );
});
test("unclassified institutional notices remain available through all procurement without becoming medical items", async () => {
  await collect(table(row("SYNTHETIC Construction of boundary wall")));
  assert.equal((await analytics.overview(f())).tenders, 0);
  assert.equal((await analytics.overview(filterSchema.parse({}))).tenders, 1);
});
test("additive migration preserves pauses, unrelated checkpoints and existing observations", async () => {
  await collect(table());
  await db.query("UPDATE source SET enabled=false WHERE id=$1", [current.id]);
  await db.query(
    "UPDATE source SET checkpoint=$1 WHERE id='aiims-delhi-archive-open'",
    [getSource("aiims-delhi-archive-open").url + "?start=50"],
  );
  await db.query(
    "UPDATE source SET adapter=NULL,enabled=false,listing_url='https://aiimsbhubaneswar.nic.in/old/',checkpoint='https://aiimsbhubaneswar.nic.in/old/' WHERE id=$1",
    [archive.id],
  );
  await db.transaction((q) => new OdishaCoverage1792415000000().up(q));
  const [c] = await db.query("SELECT * FROM source WHERE id=$1", [current.id]),
    [a] = await db.query("SELECT * FROM source WHERE id=$1", [archive.id]);
  assert.equal(c.enabled, false);
  assert.equal(a.enabled, true);
  assert.equal(a.checkpoint, null);
  assert.match(
    (
      await db.query(
        "SELECT checkpoint FROM source WHERE id='aiims-delhi-archive-open'",
      )
    )[0].checkpoint,
    /start=50$/,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
    1,
  );
});
