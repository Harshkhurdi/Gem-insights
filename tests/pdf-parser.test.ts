import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTender,
  stableItemKey,
  ExtractedPage,
} from "../packages/core/pdf-extraction";
import { taxonomy } from "../packages/core/taxonomy";
import { classify } from "../packages/core/domain";
import { sampleText } from "./pdf-fixtures";
const rules = Object.values(taxonomy)
  .flat()
  .map(([id, name, aliases]) => ({ id, name, aliases, category_id: "" }));
const parse = (text: string) =>
  extractTender(
    [{ page: 1, text, method: "embedded", readable: true }],
    "https://example.org/synthetic-test.pdf",
    rules,
  );
test("structured fields retain source pages and separate dates", () => {
  const r = parse(sampleText());
  assert.equal(r.record.bidNumber, "GEM/2026/B/8800001");
  assert.equal(r.record.publishedAt, "2026-10-01");
  assert.equal(r.record.closesAt, "2026-10-30T15:00:00+05:30");
  assert.equal(r.record.buyer.state, "Punjab");
  assert.equal(r.record.items.length, 1);
  assert.equal(r.record.items[0].quantity, "12");
  assert.equal(r.record.items[0].unit, "units");
  assert.equal(r.record.items[0].destinations[0].quantity, "12");
  assert.equal(r.evidence.bidNumber[0].page, 1);
});
test("GeMARPTS incidental matches are not requested line items", () => {
  const r = parse(sampleText({ product: "ICU ventilator" }));
  assert.equal(r.record.items.length, 1);
  assert.equal(r.record.items[0].name, "ICU ventilator");
});
test("multiple product headings become separate stable lines", () => {
  const r = parse(
    sampleText() +
      "\nICU ventilator ( 3 pieces )\nTechnical Specifications\nTEST\nConsignees\nDelivery State: Haryana; Quantity: 3",
  );
  assert.equal(r.record.items.length, 2);
  assert.equal(r.record.items[1].quantity, "3");
  assert.equal(r.record.items[1].destinations[0].state, "Haryana");
});
test("line keys survive quantity and item-order amendments", () => {
  const a = parse(sampleText({ quantity: "12" })),
    b = parse(sampleText({ quantity: "24" }));
  assert.equal(a.record.items[0].key, b.record.items[0].key);
  assert.equal(
    stableItemKey("Patient Monitor (V2)"),
    stableItemKey("patient monitor"),
  );
});
test("missing quantities stay null and bundled total is not copied to every product", () => {
  const r = parse(
    sampleText()
      .replace("Patient monitor ( 12 pieces )", "")
      .replace(
        "Item Category: Patient monitor",
        "Item Category: Patient monitors; ICU ventilators",
      ),
  );
  assert.equal(r.record.items[0].quantity, null);
  assert.ok(r.warnings.some((w) => w.includes("several products")));
});
test("buyer address and consignee postcode do not invent confirmed states", () => {
  const r = parse(
    sampleText()
      .replace("Buyer State: Punjab", "Ministry/State Name: Ministry Of Health")
      .replace(
        "Delivery State: Punjab; District: Mohali; Quantity: 12",
        "151001, Mandi Dabwali Road 12 45",
      ),
  );
  assert.equal(r.record.buyer.state, null);
  assert.equal(r.record.items[0].destinations.length, 0);
});
test("only explicit estimates count; EMD and turnover are not price", () => {
  const r = parse(
    sampleText({ extra: "EMD Amount: 500000\nOEM Turnover: 1000 Lakh" }),
  );
  assert.equal(r.record.estimatedValue, null);
  const v = parse(
    sampleText({ extra: "Estimated Tender Value (INR): 250,000.00" }),
  );
  assert.equal(v.record.estimatedValue, "250000.00");
});
test("civil work, service and accessory names do not become equipment", () => {
  for (const product of [
    "Civil repair of hospital ICU",
    "AMC of ICU ventilator",
    "Ultrasound probes",
    "Patient monitor cables",
  ]) {
    const r = parse(sampleText({ product }));
    assert.equal(r.classifications[r.record.items[0].key].productId, null);
  }
});
test("entire equipment with included maintenance is distinguished from a service-only notice", () => {
  assert.equal(
    classify("Patient monitor with CMC for five years", rules).productId,
    "patient-monitors",
  );
  assert.equal(classify("AMC of patient monitor", rules).productId, null);
});
test("specific compound product alias dominates its contained generic alias", () => {
  const extended = rules.map((r) =>
    r.id === "syringe-pumps"
      ? { ...r, aliases: [...r.aliases, "syringe infusion pump"] }
      : r,
  );
  assert.equal(
    classify("Syringe infusion pump", extended).productId,
    "syringe-pumps",
  );
  assert.equal(
    classify("Patient monitor and ICU ventilator", extended).review,
    true,
  );
});
test("OCR evidence is lower-confidence and unreadable pages are explicit", () => {
  const r = extractTender(
    [
      { page: 4, text: sampleText(), method: "tesseract", readable: true },
      { page: 5, text: "", method: "embedded", readable: false },
    ],
    null,
    rules,
  );
  assert.equal(r.evidence.bidNumber[0].page, 4);
  assert.ok(r.evidence.bidNumber[0].confidence <= 0.6);
  assert.ok(r.warnings.some((w) => w.includes("Unreadable")));
});
test("a partial corrigendum cannot be mistaken for a complete original notice", () => {
  const r = parse("Corrigendum\n" + sampleText());
  assert.ok(r.warnings.some((w) => w.includes("partial record")));
});
test("duplicate headings are flagged for human review rather than silently summed", () => {
  const r = parse(sampleText() + "\nPatient monitor ( 12 pieces )");
  assert.equal(r.record.items.length, 1);
  assert.ok(r.warnings.some((w) => w.includes("Repeated product heading")));
});
test("invalid and missing publication dates remain unknown", () => {
  assert.equal(
    parse(sampleText().replace("Dated: 01-10-2026", "Dated: 31-02-2026")).record
      .publishedAt,
    null,
  );
  assert.equal(
    parse(sampleText().replace("Dated: 01-10-2026", "")).record.publishedAt,
    null,
  );
});
