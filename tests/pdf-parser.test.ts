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
import { reconstructRows } from "../scripts/pdf-layout.mjs";
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
test("SYNTHETIC explicit product quantity label does not invent an absent unit", () => {
  const r = parse("Patient Monitor — Quantity: 15");
  assert.equal(r.record.items[0].name, "Patient Monitor");
  assert.equal(r.record.items[0].quantity, "15");
  assert.equal(r.record.items[0].unit, "unknown");
  assert.equal(
    r.evidence["items." + r.record.items[0].key + ".quantity"][0].page,
    1,
  );
});
test("SYNTHETIC ventilator technical oxygen percentage is never a requested quantity", () => {
  const r = parse(
    "Ventilator supporting 100% oxygen concentration\nTechnical Specifications\nOxygen concentration: 100\nTidal volume 1000 ml",
  );
  assert.equal(r.record.items.length, 0);
});
test("SYNTHETIC quantity table supports multiple products and repeated page headers", () => {
  const r = parse(
    "S.No. Item Description Quantity Unit\n1 Patient monitor 15 pieces\nPage 1 of 2\nS.No. Item Description Quantity Unit\n2 ICU ventilator 3 units\nTechnical Specifications\n1 Oxygen concentration 100 percent",
  );
  assert.equal(r.record.items.length, 2);
  assert.equal(r.record.items[0].quantity, "15");
  assert.equal(r.record.items[1].quantity, "3");
});
test("SYNTHETIC broken table row is reconstructed across page boundaries", () => {
  const r = extractTender(
    [
      {
        page: 1,
        text: "Item Description Quantity Unit\n1 Bedside multiparameter",
        method: "embedded",
        readable: true,
      },
      {
        page: 2,
        text: "Page 2 of 2\nItem Description Quantity Unit\nmonitor 15 pieces",
        method: "embedded",
        readable: true,
      },
    ],
    null,
    rules,
  );
  assert.equal(r.record.items.length, 1);
  assert.equal(r.record.items[0].name, "Bedside multiparameter monitor");
  assert.equal(r.record.items[0].quantity, "15");
  assert.ok(
    r.evidence["items." + r.record.items[0].key + ".quantity"].some(
      (e) => e.page === 2 && e.quote.includes("15"),
    ),
  );
});
test("SYNTHETIC positioned table cells support quantity before description", () => {
  const rows = [
    { cells: ["S.No.", "Quantity", "Product Name", "Unit"] },
    { cells: ["1", "12", "Patient monitor", "pieces"] },
    { cells: ["2", "4", "ICU ventilator", "units"] },
  ];
  const r = extractTender(
    [
      {
        page: 1,
        text: rows.map((r) => r.cells.join(" ")).join("\n"),
        rows,
        method: "embedded",
        readable: true,
      },
    ],
    null,
    rules,
  );
  assert.deepEqual(
    r.record.items.map((i: any) => i.quantity),
    ["12", "4"],
  );
});
test("SYNTHETIC Hindi labels/digits retain Unicode item identities", () => {
  const r = parse(
    "बोली संख्या: GEM/2026/B/१२३४५६७\nनिविदा शीर्षक: रोगी मॉनिटर\nरोगी मॉनिटर मात्रा: १५ नग",
  );
  assert.equal(r.record.bidNumber, "GEM/2026/B/1234567");
  assert.equal(r.record.items[0].quantity, "15");
  assert.equal(r.record.items[0].unit, "units");
  assert.notEqual(stableItemKey("रोगी मॉनिटर"), stableItemKey("वेंटिलेटर"));
});
test("SYNTHETIC maintenance/accessory/medicine/civil context is excluded despite hospital equipment references", () => {
  for (const name of [
    "Annual maintenance contract for patient monitor",
    "Comprehensive maintenance contract of ICU ventilator",
    "Patient monitor accessory",
    "Medicines for ventilator patients",
    "Electrical cables for hospital ICU",
    "Renovation of anaesthesia room",
  ])
    assert.equal(classify(name, rules).productId, null);
});
test("SYNTHETIC PDF glyph positions reconstruct rows and columns in reading order", () => {
  const token = (str: string, x: number, y: number, width: number) => ({
    str,
    width,
    transform: [1, 0, 0, 1, x, y],
  });
  const rows = reconstructRows([
    token("15", 300, 700, 12),
    token("Quantity", 300, 720, 45),
    token("Patient monitor", 70, 700, 90),
    token("Product Name", 70, 720, 80),
  ]);
  assert.deepEqual(rows, [
    { cells: ["Product Name", "Quantity"] },
    { cells: ["Patient monitor", "15"] },
  ]);
});

test("global GeM placeholder category is not an equipment line and bilingual dated labels parse", () => {
  const pages = [
    {
      page: 1,
      method: "embedded" as const,
      readable: true,
      text: "SYNTHETIC TEST ONLY\nBid Number: GEM/2026/B/9990002\nअमान्य / Dated : 15-10-2026\nItem Category GlobalTenderCategory (Q3)\nCone Beam CT system for craniofacial\nअमान्य /Global Tender Title\nimaging on Turnkey Basis\nMinimum Average Annual Turnover: 50 Lakh\nTechnical Specifications\nCapacity: 100\nBid End Date/Time 05-11-2026 11:00:00",
    },
  ];
  const r = extractTender(pages, "https://example.org/synthetic", rules);
  assert.equal(r.record.publishedAt, "2026-10-15");
  assert.equal(
    r.record.title,
    "Cone Beam CT system for craniofacial imaging on Turnkey Basis",
  );
  assert.equal(r.record.items.length, 0);
  assert.ok(r.warnings.some((w) => /category ignored/.test(w)));
});
test("BOQ headers in common publisher variants activate table extraction", () => {
  const variants = [
    ["S.No.", "Item Name", "Quantity Required", "Unit"],
    ["S.No.", "Product Description", "Quantity", "Unit"],
    ["S.No.", "Item", "Qty.", "Unit"],
  ];
  for (const header of variants) {
    const rows = [
      { cells: header },
      {
        cells: ["1", "SYNTHETIC infusion pump", "7", "Nos."],
      },
    ];
    const r = extractTender(
      [
        {
          page: 1,
          text: rows.map((row) => row.cells.join(" ")).join("\n"),
          method: "embedded",
          readable: true,
          rows: rows as any,
        },
      ],
      "https://example.org/synthetic-test.pdf",
      rules,
    );
    assert.equal(r.record.items.length, 1, header.join("|"));
    assert.equal(r.record.items[0].name, "SYNTHETIC infusion pump");
    assert.equal(r.record.items[0].quantity, "7");
    assert.equal(r.record.items[0].unit, "units");
  }
});
test("a description-only header without a quantity column never activates table extraction", () => {
  const rows = [
    { cells: ["S.No.", "Description"] },
    { cells: ["1", "SYNTHETIC specification text without quantity"] },
  ];
  const r = extractTender(
    [
      {
        page: 1,
        text: rows.map((row) => row.cells.join(" ")).join("\n"),
        method: "embedded",
        readable: true,
        rows: rows as any,
      },
    ],
    "https://example.org/synthetic-test.pdf",
    rules,
  );
  assert.deepEqual(r.record.items, []);
});
test("corrigendum documents without a BOQ section explain their empty item list", () => {
  const r = parse(
    "Bid Number: GEM/2026/B/7977451\nBid Corrigendum\nGEM/2026/B/7977451-C1\nFollowing terms and conditions supersede all existing terms\nSYNTHETIC TEST ONLY",
  );
  assert.deepEqual(r.record.items, []);
  assert.ok(
    r.warnings.some((w) => /Corrigendum document/.test(w)),
    "corrigendum warning expected",
  );
});
test("additional specification parameter rows do not become items", () => {
  const rows = [
    { cells: ["S.No.", "Item Description", "Quantity", "Unit"] },
    { cells: ["1", "SYNTHETIC infusion pump", "7", "Nos."] },
    {
      cells: [
        "Additional Specification Parameters - SYNTHETIC infusion pump",
        "1",
      ],
    },
  ];
  const r = extractTender(
    [
      {
        page: 1,
        text: rows.map((row) => row.cells.join(" ")).join("\n"),
        method: "embedded",
        readable: true,
        rows: rows as any,
      },
    ],
    "https://example.org/synthetic-test.pdf",
    rules,
  );
  assert.equal(r.record.items.length, 1);
  assert.equal(r.record.items[0].name, "SYNTHETIC infusion pump");
});
test("spec headers preceded by empty cells still reset table extraction", () => {
  const rows = [
    { cells: ["S.No.", "Item Description", "Quantity", "Unit"] },
    { cells: ["1", "SYNTHETIC infusion pump", "7", "Nos."] },
    {
      cells: [
        "",
        "Additional Specification Parameters - SYNTHETIC infusion pump",
        "1",
      ],
    },
  ];
  const r = extractTender(
    [
      {
        page: 1,
        text: rows.map((row) => row.cells.join(" ")).join("\n"),
        method: "embedded",
        readable: true,
        rows: rows as any,
      },
    ],
    "https://example.org/synthetic-test.pdf",
    rules,
  );
  assert.equal(r.record.items.length, 1);
  assert.equal(r.record.items[0].name, "SYNTHETIC infusion pump");
});
