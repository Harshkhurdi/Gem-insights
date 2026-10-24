import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { CentralCoverage1792420000000 } from "../apps/api/src/migrations/central-coverage";
import { CentralEquipment1792421000000 } from "../apps/api/src/migrations/central-equipment";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import { parseListing, noticeKey } from "../apps/api/src/collection/parsers";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import {
  bhopalPage,
  bhopalManualRow,
  cgmsclRow,
  cgmsclTable,
} from "./central-coverage-fixtures";
const bhopal = getSource("aiims-bhopal");
test("AIIMS Bhopal collects medical sections with explicit dates, native references and documents", () => {
  const r = parseListing(bhopalPage(), bhopal);
  assert.equal(r.notices.length, 3);
  assert.equal(r.next, null);
  const manual = r.notices.find((n) => n.title.includes("Cystoscopy"))!;
  assert.equal(
    manual.bidNumber,
    "AIIMS/BPL/CS/2026-27/ENT/PAC/D&SS/1103".replace(/\s*\/\s*/g, "/"),
  );
  assert.equal(manual.publishedAt, "2026-09-25");
  assert.equal(manual.closingDate, "2026-10-08");
  assert.equal(manual.state, "Madhya Pradesh");
  assert.equal(manual.buyer, "AIIMS Bhopal");
  assert.match(manual.url, /manualTender\/original\.pdf$/);
  assert.equal(
    manual.key,
    noticeKey(bhopal, manual.bidNumber, manual.url, manual.title),
  );
});
test("AIIMS Bhopal e-tender titles keep GeM identity and engineering or vendor sections stay excluded", () => {
  const r = parseListing(bhopalPage(), bhopal);
  const gem = r.notices.find((n) => n.portal === "gem")!;
  assert.equal(gem.bidNumber, "GEM/2026/B/7574770");
  assert.ok(gem.documents.every((d) => d.includes("aiimsbhopal.edu.in")));
  assert.ok(
    r.notices.every((n) => !/playground/i.test(n.title)),
    "engineering works must not be collected",
  );
});
test("AIIMS Bhopal placeholder epoch and portal-reference dates never become bid dates", () => {
  const r = parseListing(
    bhopalPage(
      bhopalManualRow(
        "AIIMS/BPL/CS/2026-27/X/1",
        "SYNTHETIC Supply of reagents",
        "01-Jan-1970",
        "Please refer CPP Portal 01-Jan-1970",
      ).replace("<tr><td>1</td>", "<tr><td>2</td>"),
    ),
    bhopal,
  );
  const row = r.notices.find((n) => n.title.includes("reagents"))!;
  assert.equal(row.publishedAt, null);
  assert.equal(row.closingDate, null);
  assert.equal(row.medical, true);
});
test("AIIMS Bhopal missing medical sections or changed columns fail visibly", () => {
  for (const html of [
    bhopalPage().replace(
      "<strong>E-Tenders (Hospital)</strong>",
      "<strong>Other</strong>",
    ),
    bhopalPage().replace("Manual Tender", "Unexpected Section"),
  ])
    assert.throws(
      () => parseListing(html, bhopal),
      /missing|columns|no records/,
    );
  assert.throws(
    () =>
      parseListing(
        bhopalPage().replace("<td>Tender Title</td>", "<td>Subject</td>"),
        bhopal,
      ),
    /columns changed/,
  );
});
test("CGMSCL equipment rows normalize slash-free GeM numbers and keep official attachment-list evidence links", () => {
  const src = getSource("cgmscl-equipment");
  const n = parseListing(cgmsclTable(), src).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/8053870");
  assert.equal(n.portal, "gem");
  assert.equal(
    n.url,
    "https://www.cgmsc.gov.in/cgmscl/Home/AttachmentList.aspx?a=202610000002",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.state, "Chhattisgarh");
  assert.equal(n.buyer, "Chhattisgarh Medical Services Corporation");
});
test("CGMSCL native references stay institutional and missing detail links keep title identity", () => {
  const src = getSource("cgmscl-equipment");
  const r = parseListing(
    cgmsclTable(
      cgmsclRow(
        "Tender Ref. No.: 271/CGMSCL/2026-27, Dt.: 02/09/2026 e-proc NIT No. 198742 Supply of SYNTHETIC Patient monitors",
      ).replace(
        " onClick=\"javascript:window.location='&#39;/cgmscl/Home/AttachmentList.aspx?a=202610000002&#39;';\"",
        "",
      ) +
        cgmsclRow(
          "SYNTHETIC Supply of ventilators",
          "/cgmscl/Home/AttachmentList.aspx?a=2",
        ),
    ),
    src,
  );
  const native = r.notices.find((n) => n.bidNumber?.startsWith("271/"))!;
  assert.equal(native.portal, "institution");
  assert.equal(native.url, src.url);
  assert.equal(native.publishedAt, null);
  assert.equal(r.notices.length, 2);
  assert.notEqual(r.notices[0].key, r.notices[1].key);
  assert.throws(
    () => parseListing(cgmsclTable().replace(">S.No</th>", ">Ref</th>"), src),
    /table missing/,
  );
  assert.throws(
    () => parseListing(cgmsclTable().replace("<td>1</td>", ""), src),
    /expected four columns/,
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
  await db.transaction((q) => new CentralCoverage1792420000000().up(q));
  await db.transaction((q) => new CentralEquipment1792421000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (id: string, html: string, budget = 25) =>
  new Collection(db, async () => html, 0, budget).run(id);
test("AIIMS Bhopal enters main insights immediately with dated records and unknown quantities", async () => {
  await collect(bhopal.id, bhopalPage());
  const o = await a.overview(f);
  assert.equal(o.tenders, 3);
  assert.equal(o.undated_tenders, 0);
  assert.ok(
    (await a.products(f)).every((p) =>
      Object.values(p.quantities || {}).every((v) => v === null),
    ),
  );
  const trends = await a.trends(f);
  assert.ok(trends.length >= 1);
  const states = await a.states(f);
  assert.deepEqual(
    states
      .filter((s: any) => s.state === "Madhya Pradesh")
      .map((s: any) => s.state),
    ["Madhya Pradesh"],
  );
});
test("AIIMS Bhopal native NIQ references stay distinct while repeated collection is unchanged", async () => {
  await collect(bhopal.id, bhopalPage());
  await collect(bhopal.id, bhopalPage());
  assert.equal((await a.overview(f)).tenders, 3);
  const niq = await db.query(
    "SELECT count(*)::int n FROM discovered_notice WHERE bid_number=$1",
    ["AIIMS/CENTRAL_STORES/LPC/2026-27/1100"],
  );
  assert.equal(niq[0].n, 1);
});
test("central migration registers Bhopal enabled and the national queue counts it outside North", async () => {
  const row = (
    await db.query("SELECT adapter,enabled FROM source WHERE id='aiims-bhopal'")
  )[0];
  assert.equal(row.adapter, "bhopal");
  assert.equal(row.enabled, true);
  assert.equal(SOURCES.filter((s) => s.adapter).length, 67);
  assert.equal(SOURCES.length, 118);
  const old = process.env.COLLECTION_REGION;
  process.env.COLLECTION_REGION = "north";
  try {
    assert.equal((await new Collection(db).queue()).queued, 50);
  } finally {
    if (old == null) delete process.env.COLLECTION_REGION;
    else process.env.COLLECTION_REGION = old;
  }
  await db.query("TRUNCATE job");
  assert.equal((await new Collection(db).queue()).queued, 67);
});
