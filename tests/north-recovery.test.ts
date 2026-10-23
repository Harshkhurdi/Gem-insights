import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { NorthRecovery1792419000000 } from "../apps/api/src/migrations/north-recovery";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import {
  parseListing,
  pageAllowed,
  noticeKey,
} from "../apps/api/src/collection/parsers";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import {
  jodhpurTable,
  jodhpurRow,
  sgpgimsTable,
  sgpgimsRow,
  phscCurrentTable,
  phscCurrentRow,
  phscArchiveTable,
  phscArchiveRow,
  hmsclTable,
  hmsclRow,
  hmsclEmpty,
} from "./north-recovery-fixtures";
const jodhpur = getSource("aiims-jodhpur"),
  sgpgims = getSource("sgpgims"),
  phsc = getSource("phsc"),
  hmscl = getSource("hmscl");
test("AIIMS Jodhpur keeps GeM references, original documents and unverified generic dates", () => {
  const n = parseListing(jodhpurTable(), jodhpur).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/8077851");
  assert.equal(n.portal, "gem");
  assert.equal(n.title, "SYNTHETIC Piezosurgery Unit");
  assert.match(n.url, /tender\/2026\/10\/original\.pdf$/);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-16");
  assert.equal(n.state, "Rajasthan");
  assert.equal(n.buyer, "AIIMS Jodhpur");
  assert.equal(n.key, noticeKey(jodhpur, n.bidNumber, n.url, n.title));
});
test("AIIMS Jodhpur native references stay institutional and layout changes fail visibly", () => {
  const n = parseListing(
    jodhpurTable(jodhpurRow("AIIMSJ-PROC/46/2026")),
    jodhpur,
  ).notices[0];
  assert.equal(n.bidNumber, "AIIMSJ-PROC/46/2026");
  assert.equal(n.portal, "institution");
  assert.equal(n.publishedAt, null);
  assert.throws(
    () =>
      parseListing(
        jodhpurTable(
          jodhpurRow().replace(
            "</td><td class='date-column'>",
            "</td><td>EXTRA</td><td class='date-column'>",
          ),
        ),
        jodhpur,
      ),
    /expected five columns/,
  );
  assert.throws(
    () => parseListing("<h1>Maintenance</h1>", jodhpur),
    /table missing/,
  );
});
test("AIIMS Jodhpur follows only its own advancing numeric pages with an empty search filter", () => {
  const s = getSource("aiims-jodhpur"),
    html = jodhpurTable() + '<a href="tenders.php?page=2&amp;search=">Next</a>';
  assert.equal(
    parseListing(html, s).next,
    "https://aiimsjodhpur.edu.in/tenders.php?page=2&search=",
  );
  assert.throws(
    () => parseListing(html, s, s.url + "?page=2&search="),
    /Non-advancing/,
  );
  for (const suffix of [
    "?page=0",
    "?page=-1",
    "?page=2&page=3",
    "?page=2&search=ventilator",
    "?search=",
  ])
    assert.equal(pageAllowed(s.url + suffix, s), false, suffix);
  assert.equal(
    pageAllowed("https://other.example/tenders.php?page=2", s),
    false,
  );
  assert.throws(
    () => parseListing(html, s, s.url + "?page=3&search="),
    /Non-advancing Jodhpur/,
  );
  assert.throws(
    () =>
      parseListing(
        jodhpurTable() + '<a href="tenders.php?category=eq">Next</a>',
        s,
      ),
    /Unsupported pagination/,
  );
});
test("SGPGIMS retains notice descriptions with resolved original documents and no invented dates or references", () => {
  const n = parseListing(sgpgimsTable(), sgpgims).notices[0];
  assert.equal(n.title, "SYNTHETIC Supply of Patient Monitors for ICU");
  assert.equal(n.bidNumber, null);
  assert.equal(
    n.url,
    "https://www.sgpgims.org.in/Home/Tender/2026/original.pdf",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.medical, true);
  assert.deepEqual(n.products, ["patient-monitors"]);
  assert.equal(pageAllowed(sgpgims.url + "?page=2", sgpgims), false);
  assert.throws(
    () =>
      parseListing(
        sgpgimsTable(
          sgpgimsRow().replace("</td><td", "</td><td>EXTRA</td><td"),
        ),
        sgpgims,
      ),
    /expected three columns/,
  );
});
test("SGPGIMS non-procurement estate notices remain visible without medical claims", () => {
  const n = parseListing(
    sgpgimsTable(
      sgpgimsRow(
        "SYNTHETIC Auction Notice: Shops situated at Community Center",
        "../Home/Estate/2026/estate.pdf",
      ),
    ),
    sgpgims,
  ).notices[0];
  assert.equal(n.medical, false);
  assert.deepEqual(n.products, []);
  assert.equal(n.url, "https://www.sgpgims.org.in/Home/Estate/2026/estate.pdf");
});
test("PHSC normalizes native BID references and strips document-format chrome without asserting publication", () => {
  const n = parseListing(phscCurrentTable(), phsc).notices[0];
  assert.equal(n.bidNumber, "PHSC/Proc/2026/Quotation-EDL Medicine/69");
  assert.equal(n.portal, "institution");
  assert.equal(n.title, "PHSC invites sealed quotations");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-10-11");
  assert.equal(n.state, "Punjab");
  assert.match(n.url, /notice\.doc$/);
});
test("PHSC archived tenders follow their different published column order", () => {
  const n = parseListing(phscArchiveTable(), getSource("phsc-archive"))
    .notices[0];
  assert.equal(n.bidNumber, "PHSC/Proc/Antibiotic Discs");
  assert.equal(
    n.title,
    "SYNTHETIC RATE CONTRACT TENDER DOCUMENT: Antibiotic discs, reagents and culture media",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2017-07-10");
  assert.equal(n.medical, true);
});
test("PHSC layout changes fail visibly instead of misreading columns", () => {
  for (const html of [
    phscCurrentTable().replace("<th>BID No</th>", "<th>Ref</th>"),
    "<h1>Procurement Wing</h1>",
  ])
    assert.throws(() => parseListing(html, phsc), /table missing/);
  assert.throws(
    () =>
      parseListing(
        phscCurrentTable(phscCurrentRow().replace("<td>1</td>", "")),
        phsc,
      ),
    /expected five columns/,
  );
});
test("HMSCL populated rows keep references, documents and corrigenda without inventing bid dates", () => {
  const n = parseListing(hmsclTable(), hmscl).notices[0];
  assert.equal(n.bidNumber, "HMSCL/EQ/2026/01");
  assert.equal(n.title, "SYNTHETIC Supply of ICU Ventilators");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Haryana");
  assert.equal(n.url, "https://hmscl.org.in/Content/tenders/2026/original.pdf");
  assert.ok(
    n.documents.includes(
      "https://hmscl.org.in/Content/tenders/2026/corrigendum.pdf",
    ),
  );
  assert.deepEqual(n.products, ["icu-ventilators", "ventilators-other"]);
});
test("HMSCL explicit publisher empty state records an honest empty listing while layouts still fail visibly", () => {
  assert.deepEqual(parseListing(hmsclEmpty, hmscl), {
    notices: [],
    next: null,
  });
  assert.throws(
    () => parseListing(hmsclTable(hmsclRow().replace("<td>1</td>", "")), hmscl),
    /expected seven columns/,
  );
  assert.equal(
    pageAllowed("https://hmscl.org.in/Page.aspx?slug=drugs-tenders", hmscl),
    false,
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
  await db.transaction((q) => new NorthRecovery1792419000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (id: string, html: string, budget = 25) =>
  new Collection(db, async () => html, 0, budget).run(id);
test("PHSC follows only its Drupal pager's advancing zero-based pages", () => {
  const s = getSource("phsc");
  const html =
    phscCurrentTable() +
    '<li class="pager__item pager__item--next"><a href="?page=1">Next page ››</a></li>';
  assert.equal(
    parseListing(html, s).next,
    "https://phsc.punjab.gov.in/en/tendersProcurement?page=1",
  );
  for (const suffix of ["?page=1&page=2", "?page=x", "?page=1&text=q"])
    assert.equal(pageAllowed(s.url + suffix, s), false, suffix);
  assert.throws(
    () => parseListing(html, s, s.url + "?page=2"),
    /Non-advancing PHSC/,
  );
  assert.throws(
    () =>
      parseListing(
        phscCurrentTable() +
          '<li class="pager__item pager__item--next"><a href="/en/other">Next page ››</a></li>',
        s,
      ),
    /Unsupported pagination/,
  );
});
test("recovered northern sources enter main insights immediately with unknown quantities and honest dates", async () => {
  await collect(
    jodhpur.id,
    jodhpurTable(jodhpurRow("GEM/2026/B/1", "SYNTHETIC ICU Ventilators")),
  );
  await collect(sgpgims.id, sgpgimsTable());
  await collect(
    phsc.id,
    phscCurrentTable(
      phscCurrentRow(
        "PHSC/ Proc/ 2026/ SYNTHETIC medicines quotation/ 1",
        "SYNTHETIC Supply of hospital medicines",
      ),
    ),
  );
  await collect(
    "phsc-archive",
    phscArchiveTable(
      phscArchiveRow(
        "PHSC/Proc/SYNTHETIC reagents",
        "SYNTHETIC RATE CONTRACT TENDER DOCUMENT: Antibiotic discs, reagents and culture media",
      ),
    ),
  );
  await collect(hmscl.id, hmsclEmpty);
  const o = await a.overview(f);
  assert.equal(o.tenders, 4);
  assert.equal(o.undated_tenders, 4);
  assert.ok(
    (await a.products(f)).every((p) =>
      Object.values(p.quantities || {}).every((v) => v === null),
    ),
  );
  assert.deepEqual(
    await a.states(filterSchema.parse({ medical: "true", basis: "delivery" })),
    [],
  );
  const summary = await new Collection(db).summary();
  const byId = Object.fromEntries(
    summary.sources.map((s: any) => [s.id, s.notices]),
  );
  assert.equal(byId["aiims-jodhpur"], 1);
  assert.equal(byId["sgpgims"], 1);
  assert.equal(byId["phsc"], 1);
  assert.equal(byId["phsc-archive"], 1);
  assert.equal(byId["hmscl"], 0);
});
test("an explicit GeM reference on Jodhpur groups with the same GeM bid observed by another profile", async () => {
  await collect(
    jodhpur.id,
    jodhpurTable(jodhpurRow("GEM/2026/B/123456", "SYNTHETIC Ventilators")),
  );
  await collect(
    "aiims-gorakhpur",
    `<table class="display"><thead><tr><th>Title</th><th>Start Date</th><th>End Date</th></tr></thead><tbody><tr><td><div class="blog_ref"><h4>SYNTHETIC GEM/2026/B/123456 Updated ventilators</h4><a href="/wp-content/uploads/a.pdf">Original</a></div></td><td>17-Oct-2026</td><td>30-Oct-2026</td></tr></tbody></table>`,
  );
  assert.equal((await a.overview(f)).tenders, 1);
});
test("recovery migration enables rechecked listings, preserves local pauses and keeps PGIMER assisted", async () => {
  await db.query("UPDATE source SET enabled=false WHERE id='hmscl'");
  await db.query("UPDATE source SET checkpoint=$1 WHERE id='aiims-jodhpur'", [
    jodhpur.url + "#saved",
  ]);
  await db.transaction((q) => new NorthRecovery1792419000000().up(q));
  const rows = await db.query(
    "SELECT id,enabled,adapter,checkpoint FROM source WHERE id=ANY($1)",
    [["aiims-jodhpur", "sgpgims", "phsc", "phsc-archive", "hmscl", "pgimer"]],
  );
  const byId = Object.fromEntries(rows.map((r: any) => [r.id, r]));
  assert.equal(byId["aiims-jodhpur"].checkpoint, jodhpur.url + "#saved");
  assert.equal(byId["hmscl"].enabled, false);
  for (const id of ["aiims-jodhpur", "sgpgims", "phsc", "phsc-archive"])
    assert.ok(byId[id].adapter, id);
  assert.equal(byId["pgimer"].adapter, null);
  assert.equal(byId["pgimer"].enabled, false);
});
test("North queue schedules the recovered profiles while unresolved targets stay disabled", async () => {
  const old = process.env.COLLECTION_REGION;
  process.env.COLLECTION_REGION = "north";
  try {
    assert.equal(SOURCES.filter((s) => s.adapter).length, 54);
    assert.equal(SOURCES.length, 102);
    assert.equal((await new Collection(db).queue()).queued, 49);
    for (const id of [
      "safdarjung",
      "pgimer",
      "aiims-gorakhpur-archive",
      "rmlh",
      "bfuhs",
    ])
      assert.equal(
        (await db.query("SELECT enabled FROM source WHERE id=$1", [id]))[0]
          .enabled,
        false,
        id,
      );
  } finally {
    if (old == null) delete process.env.COLLECTION_REGION;
    else process.env.COLLECTION_REGION = old;
  }
});
