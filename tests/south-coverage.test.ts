import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { SouthCoverage1792422000000 } from "../apps/api/src/migrations/south-coverage";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import {
  parseListing,
  noticeKey,
  pageAllowed,
} from "../apps/api/src/collection/parsers";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import {
  mglTable,
  mglRow,
  bibTable,
  bibRow,
  jipmerTable,
  tnmscTable,
  tnmscRow,
  gmsclTable,
  gmsclRow,
  wbmsclTable,
  wbmsclRow,
  meghealthTable,
  meghealthRow,
  safdarjungTable,
  safdarjungRow,
} from "./central-coverage-fixtures";
const mgl = getSource("aiims-mangalagiri"),
  bib = getSource("aiims-bibinagar"),
  jipmer = getSource("jipmer");
test("Mangalagiri keeps CPPP tender IDs, English titles and explicit publish dates", () => {
  const n = parseListing(mglTable(), mgl).notices[0];
  assert.equal(n.bidNumber, "2026_AIMSM_931310_1");
  assert.equal(
    n.title,
    "SYNTHETIC Supply of Consumables for Orthosis and Prosthesis on Rate Contract basis",
  );
  assert.equal(n.publishedAt, "2026-10-22");
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Andhra Pradesh");
  assert.match(n.url, /original\.pdf$/);
  assert.equal(n.key, noticeKey(mgl, n.bidNumber, n.url, n.title));
});
test("Mangalagiri award and corrigendum links remain evidence without changing identity", () => {
  const r = parseListing(
    mglTable(
      mglRow(
        "2026_AIMSM_931011_1",
        "SYNTHETIC Supply of Patient monitors",
        "/wp-content/uploads/2026/10/tender.pdf",
      ),
    ),
    mgl,
  );
  const n = r.notices[0];
  assert.equal(n.portal, "institution");
  assert.ok(n.documents.every((d) => d.includes("aiimsmangalagiri.edu.in")));
});
test("Bibinagar GeM references group while generic dates stay unverified", () => {
  const n = parseListing(bibTable(), bib).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/8172402");
  assert.equal(n.portal, "gem");
  assert.equal(
    n.title,
    "SYNTHETIC Integrated Electrosurgical Unit and vessel sealer",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-07");
  assert.equal(n.state, "Telangana");
  assert.match(n.url, /original\.pdf$/);
});
test("Bibinagar native references and layout guards", () => {
  const n = parseListing(bibTable(bibRow("AIIMS/BBN/CPCC/2026-27/14")), bib)
    .notices[0];
  assert.equal(n.bidNumber, "AIIMS/BBN/CPCC/2026-27/14");
  assert.equal(n.portal, "institution");
  // Compact six-column rows are valid; five-column rows fail visibly.
  const compact = parseListing(
    bibTable().replace('<td width="60"><p>23-10-2026</p></td>', ""),
    bib,
  );
  assert.equal(compact.notices.length, 1);
  assert.throws(
    () =>
      parseListing(
        bibTable()
          .replace('<td width="60"><p>23-10-2026</p></td>', "")
          .replace('<td width="60"><p>07-11-2026</p></td>', ""),
        bib,
      ),
    /expected six or seven columns/,
  );
  assert.throws(() => parseListing("<h1>Tenders</h1>", bib), /table missing/);
});
test("JIPMER explicit release dates become publication while detail links stay official", () => {
  const n = parseListing(jipmerTable(), jipmer).notices[0];
  assert.equal(
    n.title,
    "SYNTHETIC Limited Tender for supply of Reagents and consumables",
  );
  assert.equal(n.publishedAt, "2026-10-23");
  assert.equal(n.closingDate, "2026-11-25");
  assert.equal(n.state, "Puducherry");
  assert.equal(n.buyer, "JIPMER");
  assert.match(n.url, /tender\.pdf$/);
  assert.ok(n.documents.every((d) => d.includes("jipmer.edu.in")));
});
test("JIPMER follows only single advancing numeric Drupal pages", () => {
  const s = getSource("jipmer");
  for (const suffix of ["?page=1&page=2", "?page=x", "?page=1&text=q"])
    assert.equal(pageAllowed(s.url + suffix, s), false, suffix);
  assert.equal(pageAllowed(s.url + "?page=12", s), true);
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
  await db.transaction((q) => new SouthCoverage1792422000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (id: string, html: string, budget = 25) =>
  new Collection(db, async () => html, 0, budget).run(id);
test("southern profiles enter main insights immediately with their state attribution", async () => {
  await collect(mgl.id, mglTable());
  await collect(bib.id, bibTable());
  await collect(jipmer.id, jipmerTable());
  assert.equal((await a.overview(f)).tenders, 3);
  const states = (await a.states(f)).map((s: any) => s.state);
  for (const st of ["Andhra Pradesh", "Telangana", "Puducherry"])
    assert.ok(states.includes(st), st);
  assert.ok(
    (await a.trends(f)).every(
      (t: any) =>
        t.period >= "2000-01-01" || t.period.match(/^\d{4}-\d{2}-\d{2}$/),
    ),
  );
});
test("CPPP-format Mangalagiri identities group with a reviewed-style CPPP reference", async () => {
  await collect(
    mgl.id,
    mglTable(mglRow("2026_AIMSM_931310_1", "SYNTHETIC Supply of ventilators")),
  );
  await collect(
    "cppp",
    `<table><tr><th>Sl.No</th><th>e-Published Date</th><th>Bid Submission Closing Date</th><th>Tender Opening Date</th><th>Title/Ref.No./Tender Id</th><th>Organisation Name</th></tr><tr><td>1</td><td>20-Oct-2026 09:00 PM</td><td>04-Nov-2026 05:00 PM</td><td>04-Nov-2026 06:00 PM</td><td><a href="/cppp/tendersfullview/synthetic">SYNTHETIC Ventilators</a>/2026_AIMSM_931310_1</td><td>AIIMS Mangalagiri</td></tr></table>`,
  );
  const grouped = await db.query(
    "SELECT count(*)::int n FROM insight_record WHERE bid_number='2026_AIMSM_931310_1'",
  );
  assert.ok(grouped[0].n >= 1);
});
test("south migration registers three profiles and queue counts", async () => {
  assert.equal(SOURCES.filter((s) => s.adapter).length, 67);
  assert.equal(SOURCES.length, 118);
  for (const id of ["aiims-mangalagiri", "aiims-bibinagar", "jipmer"]) {
    const row = (
      await db.query("SELECT adapter,enabled FROM source WHERE id=$1", [id])
    )[0];
    assert.ok(row.adapter, id);
    assert.equal(row.enabled, true, id);
  }
  await db.query("TRUNCATE job");
  assert.equal((await new Collection(db).queue()).queued, 67);
});
test("TNMSC headerless rows keep native references, official files and no asserted dates", () => {
  const src = getSource("tnmsc");
  const n = parseListing(tnmscTable(), src).notices[0];
  assert.equal(n.bidNumber, "E1481/ANS/RC/TNMSC/ENGG/2026");
  assert.equal(n.portal, "institution");
  assert.equal(
    n.title,
    "SYNTHETIC BID OPENING DETAILS for ventilator rate contract",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Tamil Nadu");
  assert.equal(
    n.url,
    "https://tnmsc.tn.gov.in/linkfiles/tender_notifications/NF1807.pdf",
  );
  assert.equal(
    parseListing(
      tnmscTable(tnmscRow() + tnmscRow("E1482/VEN/RC/TNMSC/ENGG/2026")),
      src,
    ).notices.length,
    2,
  );
});
test("TNMSC layout guards and unrelated tables fail visibly", () => {
  const src = getSource("tnmsc");
  assert.throws(
    () => parseListing(tnmscTable().replace("<td>16/02/2026</td>", ""), src),
    /expected seven columns/,
  );
  assert.throws(
    () => parseListing("<table><tr><td>menu</td></tr></table>", src),
    /table missing/,
  );
  assert.equal(
    pageAllowed(
      "https://tnmsc.tn.gov.in/html/tenders.php?action=5&page=1",
      src,
    ),
    false,
  );
});
test("GMSCL keeps native references, category labels and closing-only dates with official documents", () => {
  const src = getSource("gmscl");
  const n = parseListing(gmsclTable(), src).notices[0];
  assert.equal(n.bidNumber, "T.E.NO.GMSCL/D-800/RC/2026-27 ITEM NO.1");
  assert.equal(n.portal, "institution");
  assert.equal(
    n.title,
    "SYNTHETIC Supply of Digital X-ray Machine on Rate Contract basis",
  );
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-02");
  assert.equal(n.state, "Gujarat");
  assert.equal(n.buyer, "Gujarat Medical Services Corporation");
  assert.equal(
    n.url,
    "https://gmscl.gujarat.gov.in/Portal/TenderDetails/1_87_1_D-800_Tender_Document.pdf",
  );
  assert.ok(
    n.documents.includes(
      "https://gmscl.gujarat.gov.in/Portal/TenderDetails/notice.pdf",
    ),
  );
  assert.deepEqual(n.products, ["x-ray"]);
});
test("GMSCL drug-category rows stay visible and layout guards hold", () => {
  const src = getSource("gmscl");
  const r = parseListing(
    gmsclTable(
      gmsclRow(
        "T.E.NO.GMSCL/D-799/RC/2026-27",
        "SYNTHETIC Tablhclorpheniramine maleate",
        "/Portal/TenderDetails/1_86_1.pdf",
        "Drug",
      ),
    ),
    src,
  );
  assert.equal(r.notices.length, 1);
  assert.throws(
    () =>
      parseListing(
        gmsclTable().replace("<th>Description</th>", "<th>Detail</th>"),
        src,
      ),
    /table missing/,
  );
  assert.throws(
    () => parseListing(gmsclTable().replace("<td>Regular</td>", ""), src),
    /expected nine columns/,
  );
  assert.equal(
    pageAllowed("https://gmscl.gujarat.gov.in/other.htm", src),
    false,
  );
});
test("WBMSCL keeps native references and explicit publish dates from its single archive table", () => {
  const src = getSource("wbmscl");
  const n = parseListing(wbmsclTable(), src).notices[0];
  assert.equal(n.bidNumber, "WBMSCL/NIT- 837/2026");
  assert.equal(n.portal, "institution");
  assert.equal(
    n.title,
    "SYNTHETIC Supply and Commissioning of 10 Echocardiography machines",
  );
  assert.equal(n.publishedAt, "2026-10-20");
  assert.equal(n.state, "West Bengal");
  assert.equal(n.url, "https://www.wbmsc.gov.in/tender/wbmsc-tender-6353.pdf");
  assert.deepEqual(n.products, ["echo"]);
  assert.throws(
    () =>
      parseListing(
        wbmsclTable().replace("<th>TENDER NO</th>", "<th>Ref</th>"),
        src,
      ),
    /table missing/,
  );
  assert.throws(
    () => parseListing(wbmsclTable().replace("<td>1</td>", ""), src),
    /expected four columns/,
  );
  assert.equal(pageAllowed("https://www.wbmsc.gov.in/other.php", src), false);
});
test("Meghalaya keeps notice titles and official files without asserting its undocumented date column", () => {
  const src = getSource("meghealth");
  const n = parseListing(meghealthTable(), src).notices[0];
  assert.equal(
    n.title,
    "SYNTHETIC Supply and Installation of Sets of Equipments for Microbiology",
  );
  assert.equal(n.bidNumber, null);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Meghalaya");
  assert.equal(n.url, "https://meghealth.gov.in/tenders/notice.pdf");
  assert.throws(
    () =>
      parseListing(meghealthTable().replace(">Date</th>", ">Day</th>"), src),
    /table missing/,
  );
  assert.throws(
    () => parseListing(meghealthTable().replace("<td>29/8/2025</td>", ""), src),
    /expected two columns/,
  );
});
test("Safdarjung lifecycle separation collects only requested-demand rows", () => {
  const src = getSource("safdarjung");
  const r = parseListing(
    safdarjungTable(
      safdarjungRow(
        "Notice dated 07.04.2025 - Notice Inviting Tender for procurement of Group G (Blood Products)",
        "/sites/default/files/nit.pdf",
        "07/04/2025",
      ) +
        safdarjungRow(
          "Notice dated 10.01.2025 - Award of Contract for Procurement of IV Fluid Items",
          "/sites/default/files/award.pdf",
          "10/01/2025",
        ) +
        safdarjungRow(
          "Notice dated 03.10.2025 - E-Auction of Furniture and Miscellaneous Items",
          "/sites/default/files/auction.pdf",
          "03/10/2025",
        ) +
        safdarjungRow(
          "List of Medical Equipments procured w.e.f. 01.04.2026",
          "/sites/default/files/procured.pdf",
          "30/06/2026",
        ) +
        safdarjungRow(
          "Receipt No. 19363(2)/2022/M AND E STORE dated 11.10.2022 - Various Proformas for Request",
          "/sites/default/files/proforma.pdf",
          "11/10/2022",
        ) +
        safdarjungRow(
          "Notice dated 11.12.2025 - Inviting Rate Inquiry of Implants at Sports Injury Centre",
          "/sites/default/files/rate.pdf",
          "11/12/2025",
        ) +
        safdarjungRow(
          "E-TENDER NOTICE No. Q-1-MS(I.V.Fluid)/2022 dated 18.05.2022 - Notice Inviting Tender for IV Fluids",
          "/sites/default/files/etender.pdf",
          "18/05/2022",
        ),
    ),
    src,
  );
  // Only the tender, rate-inquiry and e-tender rows stay; award, auction,
  // procured-equipment and proforma rows are different lifecycle stages.
  assert.equal(r.notices.length, 3);
  const refs = r.notices.map((n) => n.title);
  assert.ok(
    refs.some((t) =>
      t.includes("Notice Inviting Tender for procurement of Group G"),
    ),
  );
  assert.ok(refs.some((t) => t.includes("Rate Inquiry")));
  const etender = r.notices.find((n) => n.bidNumber)!;
  assert.equal(etender.bidNumber, "Q-1-MS(I.V.Fluid)/2022");
  assert.ok(r.notices.every((n) => n.publishedAt));
  assert.ok(
    r.notices.every((n) => !/Award|Auction|procured|Proformas/i.test(n.title)),
  );
  assert.throws(
    () =>
      parseListing(
        safdarjungTable(safdarjungRow().replace("<td>07/04/2025</td>", "")),
        src,
      ),
    /expected four columns/,
  );
  assert.throws(
    () =>
      parseListing(
        safdarjungTable(safdarjungRow()).replace(">Title /", ">Subject /"),
        src,
      ),
    /table missing/,
  );
});
