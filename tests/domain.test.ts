import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  validateTender,
  growth,
  stateName,
  unitName,
  digest,
  csvCell,
} from "../packages/core/domain";
import { taxonomy } from "../packages/core/taxonomy";
import { parseCSV, csvToTenders, exportCSV } from "../packages/core/csv";
import { authenticated, session, validKey } from "../apps/api/src/auth";
const rules = Object.values(taxonomy)
  .flat()
  .map(([id, name, aliases]) => ({ id, name, aliases, category_id: "" }));
const fixture = {
  bidNumber: "GEM/2026/B/10001",
  title: "TEST FIXTURE ONLY",
  sourceUrl: "https://example.org/test",
  buyer: { key: "TEST-HOSPITAL", name: "Test hospital", state: "Punjab" },
  items: [
    {
      key: "1",
      name: "Patient monitor",
      quantity: "10",
      unit: "pieces",
      evidence: "TEST ONLY",
      destinations: [],
    },
  ],
};
test("patient-monitor aliases normalize deterministically", () => {
  for (const n of [
    "Multi Parameter Monitor",
    "Multipara Monitor",
    "Bedside Patient Monitoring System",
  ])
    assert.equal(classify(n, rules).productId, "patient-monitors");
});
test("hospital civil repair remains excluded", () =>
  assert.equal(
    classify("Civil repair of hospital anaesthesia room", rules).productId,
    null,
  ));
test("maintenance, accessories and consumables are excluded", () => {
  for (const n of [
    "AMC of ICU ventilators",
    "Ultrasound probes",
    "Ventilator circuits",
    "Patient monitor cables",
    "Syringes",
  ])
    assert.equal(classify(n, rules).productId, null);
});
test("ambiguous multi-equipment description is reviewed, not fully counted twice", () => {
  const r = classify("ICU ventilator and patient monitor", rules);
  assert.equal(r.productId, null);
  assert.equal(r.review, true);
});
test("quantity and money unknowns stay null", () => {
  const t = validateTender({
    ...fixture,
    estimatedValue: null,
    items: [{ ...fixture.items[0], quantity: null }],
  });
  assert.equal(t.estimatedValue, null);
  assert.equal(t.items[0].quantity, null);
});
test("reject overallocated destinations using decimal arithmetic", () => {
  assert.throws(() =>
    validateTender({
      ...fixture,
      items: [
        {
          ...fixture.items[0],
          quantity: "0.3",
          destinations: [
            {
              state: "Punjab",
              confirmed: true,
              quantity: "0.1",
              evidence: "test",
            },
            {
              state: "Haryana",
              confirmed: true,
              quantity: "0.2001",
              evidence: "test",
            },
          ],
        },
      ],
    }),
  );
});
test("accept fractional allocations exactly", () =>
  assert.doesNotThrow(() =>
    validateTender({
      ...fixture,
      items: [
        {
          ...fixture.items[0],
          quantity: "0.3",
          destinations: [
            {
              state: "Punjab",
              confirmed: true,
              quantity: "0.1",
              evidence: "test",
            },
            {
              state: "Haryana",
              confirmed: true,
              quantity: "0.2",
              evidence: "test",
            },
          ],
        },
      ],
    }),
  ));
test("duplicate line keys are rejected", () =>
  assert.throws(() =>
    validateTender({ ...fixture, items: [fixture.items[0], fixture.items[0]] }),
  ));
test("state normalization accepts explicit aliases but rejects invented regions", () => {
  assert.equal(stateName(" Orissa "), "Odisha");
  assert.equal(stateName("PUNJAB"), "Punjab");
  assert.throws(() => stateName("Gotham"));
});
test("units normalize only equivalent pieces, not kits or sets", () => {
  assert.equal(unitName("pieces"), "units");
  assert.equal(unitName("sets"), "sets");
});
test("growth has no fabricated zero-baseline percentage", () => {
  assert.equal(growth(50, 0).percent, null);
  assert.equal(growth(4, 6).percent, null);
  assert.equal(growth(10, 5).percent, 100);
});
test("canonical source hashing ignores object key order", () =>
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 })));
test("CSV parser handles escaped quotes, commas and embedded newlines", () =>
  assert.deepEqual(parseCSV('a,b\n"one, two","line\n""quoted"""'), [
    { a: "one, two", b: 'line\n"quoted"' },
  ]));
test("CSV parser rejects malformed rows", () => {
  assert.throws(() => parseCSV("a,b\n1"));
  assert.throws(() => parseCSV("a,a\n1,2"));
  assert.throws(() => parseCSV('a\n"bad'));
});
test("CSV exports guard spreadsheet formulas", () => {
  assert.equal(csvCell("=SUM(A1)"), `"'=SUM(A1)"`);
  assert.ok(
    exportCSV([{ name: "@bad" }], { source: "test" }).includes("'@bad"),
  );
});
test("authentication requires configured key and an unexpired HMAC cookie", () => {
  process.env.ADMIN_KEY = "test-secret-not-for-production-12345";
  assert.equal(validKey("wrong"), false);
  assert.equal(authenticated(), false);
  assert.equal(authenticated("gem_session=" + session()), true);
  assert.equal(authenticated("gem_session=1.invalid"), false);
  assert.equal(
    authenticated("gem_session=" + session().replace(/.$/, "z")),
    false,
  );
  delete process.env.ADMIN_KEY;
});

test("unsupported numeric precision is rejected before database rounding", () => {
  assert.throws(() => validateTender({ ...fixture, estimatedValue: 1.234 }));
  assert.throws(() =>
    validateTender({
      ...fixture,
      items: [{ ...fixture.items[0], quantity: 0.12345 }],
    }),
  );
  assert.throws(() =>
    validateTender({ ...fixture, publishedAt: "2026-02-30" }),
  );
});
