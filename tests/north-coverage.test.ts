import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { NorthCoverage1792417000000 } from "../apps/api/src/migrations/north-coverage";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import {
  parseListing,
  pageAllowed,
  noticeKey,
} from "../apps/api/src/collection/parsers";
import {
  collectionRegion,
  collectionSources,
} from "../apps/api/src/collection/regions";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import {
  jammuTable,
  kgmuTable,
  kcgmcTable,
  healthTable,
  ladakhPage,
  skimsTable,
  jkmsclTable,
} from "./north-fixtures";
const jammu = getSource("aiims-jammu"),
  skims = getSource("skims-imports");
test("Jammu preserves original/objection links without treating Upload Date as publication", () => {
  const [n] = parseListing(
    jammuTable(
      undefined,
      undefined,
      '<a href="/objection.pdf">CPPP Details</a>',
    ),
    jammu,
  ).notices;
  assert.equal(n.title, "SYNTHETIC Patient monitors");
  assert.match(n.url, /original.pdf$/);
  assert.equal(n.documents.length, 2);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Jammu and Kashmir");
});
test("Jammu conflicting titles sharing one publisher PDF remain separate observations with restorable identities", () => {
  const html = jammuTable().replace(
    "</table>",
    jammuTable("SYNTHETIC Heart lung machine").replace(/<\/?table>/g, "") +
      "</table>",
  );
  const p = parseListing(html, jammu);
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  for (const n of p.notices)
    assert.equal(n.key, noticeKey(jammu, n.bidNumber, n.url, n.title));
});
test("Jammu complete GeM references are retained but filename numbers are not fabricated bid numbers", () => {
  const [n] = parseListing(
    jammuTable("SYNTHETIC Patient monitors GEM / 2026 / B / 123456"),
    jammu,
  ).notices;
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.equal(
    parseListing(jammuTable(undefined, "GeM-Bidding-123456.pdf"), jammu)
      .notices[0].bidNumber,
    null,
  );
});
test("KGMU reads TD headings, exact references and submission-range closing only", () => {
  const [n] = parseListing(kgmuTable(), getSource("kgmu")).notices;
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-07");
  assert.equal(n.state, "Uttar Pradesh");
  assert.equal(
    parseListing(kgmuTable("SYNTHETIC/123", "31-02-2026"), getSource("kgmu"))
      .notices[0].closingDate,
    null,
  );
});
test("KCGMC retains official PDF-viewer links, closing dates and missing originals explicitly", () => {
  const s = getSource("kcgmc"),
    [n] = parseListing(kcgmcTable(), s).notices;
  assert.equal(
    n.documents[0],
    s.url.replace("/Tender/Tender", "/Tender/ShowPDF/123"),
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-10-29");
  const p = parseListing(
    kcgmcTable(undefined, "").replace(
      "</table>",
      kcgmcTable("SYNTHETIC Reagents", "").replace(/<\/?table>/g, "") +
        "</table>",
    ),
    s,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  assert.equal(p.notices[0].url, s.url);
});
test("Haryana health retains official CDN evidence without inventing bid dates or navigating to its template archive", () => {
  const s = getSource("haryana-health"),
    [n] = parseListing(healthTable(), s).notices;
  assert.equal(n.title, "SYNTHETIC Laboratory notices — Reagents");
  assert.match(n.documents[0], /^https:\/\/cdnbbsr.s3waas.gov.in/);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(
    pageAllowed("https://haryanahealth.gov.in/past-notices/tenders", s),
    false,
  );
});
test("Ladakh selects procurement PDFs in its notice marquee and excludes recruitment, apps and footer links", () => {
  const [n, ...rest] = parseListing(
    ladakhPage(),
    getSource("nhm-ladakh"),
  ).notices;
  assert.equal(rest.length, 0);
  assert.equal(n.state, "Ladakh");
  assert.equal(n.documents.length, 1);
  assert.match(n.url, /original.pdf$/);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.throws(
    () =>
      parseListing("<title>Home:NHM Ladakh</title>", getSource("nhm-ladakh")),
    /marquee/,
  );
});
test("SKIMS retains official category articles without turning page Hits or title dates into quantity/publication", () => {
  const p = parseListing(skimsTable("123", "?start=20"), skims),
    n = p.notices[0];
  assert.equal(p.next, skims.url + "?start=20");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.deepEqual(n.documents, []);
  assert.equal("quantity" in n, false);
  assert.equal(n.state, "Jammu and Kashmir");
});
test("SKIMS rejects category changes, repeated/nonadvancing offsets and unsupported query parameters", () => {
  for (const suffix of [
    "?start=0",
    "?start=20&limit=100",
    "?start=20&start=40",
    "?limitstart=20",
  ])
    assert.throws(
      () => parseListing(skimsTable("123", suffix), skims),
      /pagination|advancing/,
    );
  assert.equal(pageAllowed(getSource("skims-purchase1").url, skims), false);
  assert.throws(
    () =>
      parseListing(
        skimsTable().replace(
          "51-materials-management-imports/123",
          "52-materials-management-purchase-i/123",
        ),
        skims,
      ),
    /official category/,
  );
});
test("northern table layouts fail visibly instead of succeeding with silently missing rows", () => {
  for (const [id, html] of [
    ["aiims-jammu", jammuTable()],
    ["kgmu", kgmuTable()],
    ["kcgmc", kcgmcTable()],
    ["haryana-health", healthTable()],
  ]) {
    assert.throws(
      () => parseListing("<h1>Unavailable</h1>", getSource(id)),
      /table missing/,
    );
    assert.throws(
      () =>
        parseListing(
          html.replace(
            "</td></tr></table>",
            "</td><td>UNEXPECTED</td></tr></table>",
          ),
          getSource(id),
        ),
      /columns/,
    );
    assert.equal(
      pageAllowed(getSource(id).url + "?page=2", getSource(id)),
      false,
    );
  }
});
test("north rollout adds thirteen profiles without enabling inaccessible targets", () => {
  assert.equal(SOURCES.filter((s) => s.adapter).length, 63);
  assert.equal(SOURCES.length, 112);
  for (const id of ["uhsr", "bfuhs", "pgimer", "rmlh"])
    assert.equal(getSource(id).adapter, null);
});
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
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
  // Earlier migration-regression files deliberately rebuild older view versions.
  // Restore the latest source identities before each northern integration case.
  await db.transaction((q) => new NorthCoverage1792417000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL,next_collection_at=now()",
  );
});
const collect = (html: string, id: string) =>
  new Collection(db, async () => html, 0).run(id);
test("northern notices feed main insights immediately with publisher-only locations and unknown quantities", async () => {
  await collect(jammuTable(), jammu.id);
  await collect(kgmuTable(), "kgmu");
  await collect(kcgmcTable(), "kcgmc");
  await collect(ladakhPage(), "nhm-ladakh");
  assert.equal((await a.overview(f)).tenders, 4);
  assert.equal((await a.overview(f)).known_value, null);
  assert.deepEqual(
    new Set((await a.states(f)).map((s: any) => s.state)),
    new Set(["Jammu and Kashmir", "Uttar Pradesh", "Haryana", "Ladakh"]),
  );
  assert.deepEqual(
    await a.states(filterSchema.parse({ medical: "true", basis: "delivery" })),
    [],
  );
  assert.ok(
    (await a.products(f)).every((p: any) =>
      Object.values(p.quantities).every((v) => v === null),
    ),
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
});
test("Jammu conflicting titles sharing a PDF remain separate in main insights while exact title/document pairs group across profiles", async () => {
  await collect(jammuTable(), jammu.id);
  await collect(jammuTable(), "aiims-jammu-open");
  assert.equal((await a.overview(f)).tenders, 1);
  await collect(jammuTable("SYNTHETIC Heart lung machine"), jammu.id);
  assert.equal((await a.overview(f)).tenders, 2);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
    3,
  );
});
test("explicit GeM IDs still group Jammu across profiles regardless of the title safety rule", async () => {
  await collect(
    jammuTable("SYNTHETIC Patient monitors GEM/2026/B/123456"),
    jammu.id,
  );
  await collect(
    jammuTable("SYNTHETIC Patient monitors GEM/2026/B/123456", "amendment.pdf"),
    "aiims-jammu-open",
  );
  assert.equal((await a.overview(f)).tenders, 1);
});
test("SKIMS bounded backfill resumes and refreshes the head without losing older notices", async () => {
  const seen: string[] = [];
  const c = new Collection(
    db,
    async (u) => {
      seen.push(u);
      const start = Number(new URL(u).searchParams.get("start") || 0);
      return skimsTable(
        String(123 + start),
        start < 40 ? "?start=" + (start + 20) : "",
      );
    },
    0,
    2,
  );
  await c.run(skims.id);
  assert.match(
    (await db.query("SELECT checkpoint FROM source WHERE id=$1", [skims.id]))[0]
      .checkpoint,
    /start=40$/,
  );
  await c.run(skims.id);
  assert.equal(
    (await db.query("SELECT checkpoint FROM source WHERE id=$1", [skims.id]))[0]
      .checkpoint,
    null,
  );
  assert.equal((await a.overview(f)).tenders, 3);
  assert.deepEqual(
    seen.map((u) => Number(new URL(u).searchParams.get("start") || 0)),
    [0, 20, 0, 40],
  );
});
test("north migration preserves pauses, existing reviews and unrelated backfill; assisted targets remain disabled", async () => {
  await collect(jammuTable(), jammu.id);
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await db.query("UPDATE source SET enabled=false WHERE id='kgmu'");
  await db.query(
    "UPDATE source SET checkpoint=$1 WHERE id='aiims-delhi-archive-open'",
    [getSource("aiims-delhi-archive-open").url + "?start=50"],
  );
  await db.transaction((q) => new NorthCoverage1792417000000().up(q));
  assert.equal(
    (await db.query("SELECT enabled FROM source WHERE id='kgmu'"))[0].enabled,
    false,
  );
  assert.match(
    (
      await db.query(
        "SELECT checkpoint FROM source WHERE id='aiims-delhi-archive-open'",
      )
    )[0].checkpoint,
    /start=50$/,
  );
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
  for (const id of ["uhsr", "bfuhs", "pgimer"])
    assert.equal(
      (await db.query("SELECT enabled FROM source WHERE id=$1", [id]))[0]
        .enabled,
      false,
    );
  for (const id of ["hmscl", "aiims-jodhpur"])
    assert.equal(
      (await db.query("SELECT enabled FROM source WHERE id=$1", [id]))[0]
        .enabled,
      true,
    );
});

test("north-first bulk queue and scheduling exclude southern profiles while explicit source actions remain available", async () => {
  const old = process.env.COLLECTION_REGION;
  process.env.COLLECTION_REGION = "north";
  try {
    const sources = collectionSources();
    assert.equal(sources.length, 49);
    assert.ok(sources.some((s) => s.id === "nhm-ladakh"));
    assert.ok(!sources.some((s) => s.id === "kmscl"));
    assert.ok(!sources.some((s) => s.id === "aiims-bhubaneswar"));
    assert.equal(collectionRegion(), "north");
    assert.throws(() => collectionRegion("invalid"), /must be/);
    const c = new Collection(db);
    assert.equal((await c.queue()).queued, 49);
    await db.query("TRUNCATE job");
    await c.schedule();
    assert.equal((await db.query("SELECT count(*)::int n FROM job"))[0].n, 49);
    assert.equal((await c.queue("kmscl")).queued, 1);
    assert.equal((await c.summary()).collectionRegion, "north");
  } finally {
    if (old == null) delete process.env.COLLECTION_REGION;
    else process.env.COLLECTION_REGION = old;
  }
});

test("JKMSCL retains row-spanned references and closing dates plus linked historical notices", () => {
  const s = getSource("jkmscl"),
    p = parseListing(jkmsclTable(), s);
  assert.equal(p.notices.length, 3);
  assert.equal(p.notices[0].bidNumber, "NIT/JKMSCL/2026/716");
  assert.equal(p.notices[1].bidNumber, "NIT/JKMSCL/2026/716");
  assert.equal(p.notices[0].closingDate, "2026-11-14");
  assert.equal(p.notices[1].closingDate, "2026-11-14");
  assert.equal(p.notices[2].closingDate, null);
  assert.equal(p.notices[2].bidNumber, null);
  assert.ok(p.notices.every((n) => n.publishedAt === null));
  assert.ok(p.notices.every((n) => n.medical));
  assert.deepEqual(p.notices[0].products, []);
  for (const n of p.notices)
    assert.equal(n.key, noticeKey(s, n.bidNumber, n.url, n.title));
  assert.equal(pageAllowed(s.url + "?page=2", s), false);
});
test("JKMSCL keeps missing links explicit and does not propagate malformed row-span attributes", () => {
  const s = getSource("jkmscl"),
    html = jkmsclTable()
      .replace('rowspan="2">14-11', 'rowspan="BROKEN">14-11')
      .replace('<a href="/pdf/amendment.pdf">View</a>', "");
  const n = parseListing(html, s).notices[1];
  assert.equal(n.closingDate, null);
  assert.equal(n.url, s.url);
  assert.deepEqual(n.documents, []);
  assert.throws(() => parseListing("<h1>Unavailable</h1>", s), /table missing/);
});
test("JKMSCL reused attachment paths do not merge unrelated native references or titles", async () => {
  const s = getSource("jkmscl");
  await collect(
    jkmsclTable().replace("/pdf/amendment.pdf", "/pdf/shared.pdf"),
    s.id,
  );
  assert.equal((await a.overview(f)).tenders, 3);
  const before = await db.query(
    "SELECT id,current_hash FROM discovered_notice ORDER BY id",
  );
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await collect(
    jkmsclTable().replace("/pdf/amendment.pdf", "/pdf/shared.pdf"),
    s.id,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int n FROM discovered_notice WHERE review_status='dismissed'",
      )
    )[0].n,
    3,
  );
  assert.deepEqual(
    await db.query("SELECT id,current_hash FROM discovered_notice ORDER BY id"),
    before,
  );
});
