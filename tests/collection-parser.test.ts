import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseListing,
  listingDate,
  pageAllowed,
  noticeClassification,
} from "../apps/api/src/collection/parsers";
import { SOURCES, getSource } from "../apps/api/src/collection/registry";
import { STATES, classify, validateTender } from "../packages/core/domain";
import { taxonomy } from "../packages/core/taxonomy";
import { csvToTenders } from "../packages/core/csv";
const rules = Object.values(taxonomy)
  .flat()
  .map(([id, name, aliases]) => ({ id, name, aliases, category_id: "" }));
import { raipur, icmr, cppp } from "./collection-fixtures";

test("registry tracks all 36 states/UTs without equating registration to live collection", () => {
  for (const state of STATES)
    assert.ok(
      SOURCES.some((s) => s.portal === "state" && s.states.includes(state)),
    );
  assert.equal(SOURCES.filter((s) => s.adapter).length, 63);
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.equal(getSource("gem").adapter, null);
  assert.throws(() => getSource("unknown"));
});
test("Raipur listing keeps native reference, original and corrigenda without inventing quantities", () => {
  const n = parseListing(raipur(), getSource("aiims-raipur")).notices[0];
  assert.equal(n.bidNumber, "SYNTHETIC/RAIPUR/1");
  assert.equal(n.portal, "institution");
  assert.equal(n.state, "Chhattisgarh");
  assert.equal(n.documents.length, 2);
  assert.equal(n.publishedAt, "2026-10-20");
  assert.equal(n.closingDate, "2026-11-05");
  assert.ok(n.products.includes("patient-monitors"));
  assert.equal("quantity" in n, false);
});
test("Raipur follows only published same-source pagination", () => {
  const s = getSource("aiims-raipur");
  assert.equal(
    parseListing(raipur("Patient monitor", "tenders.php?page=2"), s).next,
    s.url + "?page=2",
  );
  for (const next of [
    "https://evil.example/",
    "https://www.aiimsraipur.edu.in/private",
    "javascript:alert(1)",
  ])
    assert.throws(
      () => parseListing(raipur("Patient monitor", next), s),
      /pagination/,
    );
  assert.equal(
    pageAllowed("http://www.aiimsraipur.edu.in/user/tenders.php", s),
    false,
  );
});
test("ICMR preserves separate original/corrigendum discoveries for one GeM bid", () => {
  const p = parseListing(icmr, getSource("icmr"));
  assert.equal(p.notices.length, 2);
  assert.equal(p.notices[0].bidNumber, "GEM/2026/B/123456");
  assert.equal(p.notices[0].documents.length, 1);
  assert.equal(p.notices[0].state, null);
  assert.equal(p.notices[0].buyer, null);
  assert.equal(p.notices[0].closingDate, "2026-11-05");
  assert.equal(p.notices[0].portal, "gem");
  assert.ok(p.notices[0].products.includes("lab-incubators"));
  assert.equal(p.next, "https://www.icmr.gov.in/tenders?page=2");
});
test("CPPP uses native tender ID and source-recorded institution, without inferring state", () => {
  const n = parseListing(cppp, getSource("cppp")).notices[0];
  assert.equal(n.bidNumber, "2026_TEST_12345_1");
  assert.equal(n.publishedAt, "2026-10-20");
  assert.equal(n.closingDate, "2026-11-04");
  assert.equal(n.portal, "cppp");
  assert.equal(n.buyer, "TEST Hospital");
  assert.equal(n.state, null);
  assert.ok(n.products.includes("dialysis"));
});
test("missing tables, access challenges and unparseable records fail visibly", () => {
  for (const html of [
    "<html>login</html>",
    "<title>Access denied</title>",
    "<table><th>Tender.No. Publishing Date</th><tr><td>bad</td></tr></table>",
  ])
    assert.throws(() => parseListing(html, getSource("aiims-raipur")));
});
test("dates validate day/month bounds and never invent timezone or time", () => {
  for (const [input, expected] of [
    ["20-10-2026", "2026-10-20"],
    ["20-Oct-2026 09:00 PM", "2026-10-20"],
    ["Nov. 5, 2026", "2026-11-05"],
    ["2026-10-21", "2026-10-21"],
    ["31-02-2026", null],
    ["bad date", null],
  ] as const)
    assert.equal(listingDate(input), expected);
});
test("medical discovery remains broad for unfamiliar hospital products", () => {
  assert.equal(
    noticeClassification("SYNTHETIC medical equipment unknown new instrument")
      .medical,
    true,
  );
  assert.equal(
    noticeClassification("SYNTHETIC Civil repair of hospital anaesthesia room")
      .products.length,
    0,
  );
});
test("clinical families and plural forms classify without merging specific products", () => {
  for (const [name, id] of [
    ["ICU beds", "icu-beds"],
    ["Ventilators", "ventilators-other"],
    ["ICU ventilators", "icu-ventilators"],
    ["Dialysis machines", "dialysis"],
    ["ECG machines", "ecg"],
    ["Slit lamps", "slit-lamps"],
    ["Dental chairs", "dental-chairs"],
    ["Infant incubators", "neonatal-incubators"],
    ["Arthroscopy systems", "arthroscopy"],
    ["Biosafety cabinets", "biosafety-cabinets"],
    [
      "Urine chemistry and sediment analyzer for Pathology & Lab Medicine Department",
      "urine-analyzers",
    ],
  ])
    assert.equal(classify(name, rules).productId, id, name);
});
test("native references require an explicit portal while legacy GeM imports remain valid", () => {
  const base = {
    bidNumber: "2026_TEST_12345_1",
    title: "SYNTHETIC",
    sourceUrl: "https://example.org/test",
    buyer: { key: "TEST", name: "TEST" },
    items: [{ key: "1", name: "ECG machine", evidence: "SYNTHETIC" }],
  };
  assert.throws(() => validateTender(base));
  assert.equal(
    validateTender({ ...base, sourcePortal: "cppp" }).bidNumber,
    base.bidNumber,
  );
  assert.equal(
    validateTender({ ...base, bidNumber: "gem/2026/b/123456" }).bidNumber,
    "GEM/2026/B/123456",
  );
});
test("CSV identity is scoped by portal", () => {
  const data =
    "sourcePortal,bidNumber,title,sourceUrl,buyerKey,buyerName,itemKey,itemName,itemEvidence\ncppp,TEST/1,SYNTHETIC,https://example.org/test,TEST,TEST,1,ECG machine,SYNTHETIC\ninstitution,TEST/1,SYNTHETIC,https://example.org/test,TEST,TEST,1,ECG machine,SYNTHETIC";
  assert.equal(csvToTenders(data).length, 2);
});
