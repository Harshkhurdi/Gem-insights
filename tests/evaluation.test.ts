// SYNTHETIC metric simulations only; no real-PDF performance claims.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCorpus, EvaluationInput } from "../packages/core/evaluation";
function fixture(extra: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    documentId: "synthetic-metric-simulation",
    annotationVersion: 1,
    observationId: "synthetic-observation",
    parserVersion: "test",
    realOriginal: true,
    automatic: {
      bidNumber: "GEM/2026/B/1234567",
      title: "Test",
      buyer: { name: "Test buyer", state: "Punjab" },
      items: [
        {
          key: "auto",
          name: "Patient Monitor",
          quantity: "15",
          unit: "pieces",
          destinations: [],
        },
      ],
    },
    truth: {
      bidNumber: "GEM/2026/B/1234567",
      title: "Test",
      buyer: { name: "Test buyer", state: "Punjab" },
      items: [
        {
          key: "gold",
          name: "Patient monitor",
          quantity: "15.0000",
          unit: "nos",
          destinations: [],
        },
      ],
    },
    predictedCategories: { auto: "patient-monitors" },
    truthCategories: { gold: "patient-monitors" },
    matches: { gold: "auto" },
    processingStatus: "succeeded",
    processingMs: 150,
    methods: ["embedded"],
    error: null,
    errorCauses: [],
    tags: ["text-pdf"],
    ...extra,
  };
}
test("empty real corpus reports Not yet measured and null metrics", () => {
  const r = evaluateCorpus([]);
  assert.equal(r.status, "Not yet measured");
  assert.equal(r.overall.exactMatchAccuracy, null);
  assert.equal(r.processing.successRate, null);
  assert.equal(r.processing.averageProcessingMs, null);
  assert.equal(r.lineItemMatching.f1, null);
});
test("synthetic cases never contribute to real-document accuracy", () => {
  const r = evaluateCorpus([fixture({ realOriginal: false })]);
  assert.equal(r.documentsEvaluated, 0);
  assert.equal(r.excludedSyntheticDocuments, 1);
});
test("explicit matching supports renamed stable keys and normalized units/decimals", () => {
  const r = evaluateCorpus([fixture()]);
  assert.equal(r.lineItemMatching.matched, 1);
  assert.equal(r.fields["items.quantity"].exactMatchAccuracy, 1);
  assert.equal(r.fields["items.unit"].exactMatchAccuracy, 1);
  assert.equal(r.fields["buyer.district"].evaluated, 0);
  assert.match(r.status, /Limited sample/);
});
test("incorrect quantities are both false positive and false negative, with visible denominators", () => {
  const c = fixture();
  c.automatic.items[0].quantity = "100";
  const m = evaluateCorpus([c]).fields["items.quantity"];
  assert.equal(m.incorrect, 1);
  assert.equal(m.fp, 1);
  assert.equal(m.fn, 1);
  assert.equal(m.f1, 0);
  assert.equal(m.evaluated, 1);
  assert.equal(m.humanCorrectionRate, 1);
});
test("extra and missing products count explicitly, without fuzzy name matching", () => {
  const c = fixture();
  c.matches = { gold: null };
  const r = evaluateCorpus([c]);
  assert.equal(r.lineItemMatching.matched, 0);
  assert.equal(r.lineItemMatching.predicted, 1);
  assert.equal(r.lineItemMatching.expected, 1);
  assert.equal(r.fields["items.name"].missing, 1);
  assert.equal(r.fields["items.name"].spurious, 1);
  assert.equal(r.classification.falsePositives, 1);
});
test("duplicate parser matches cannot inflate recall", () => {
  const c = fixture();
  c.truth.items.push({ ...c.truth.items[0], key: "gold2" });
  c.matches.gold2 = "auto";
  assert.throws(() => evaluateCorpus([c]), /one-to-one/);
});
test("classification false-positive rate includes excluded negative equipment examples", () => {
  const c = fixture();
  c.truthCategories.gold = null;
  const r = evaluateCorpus([c]);
  assert.equal(r.classification.negativeOpportunities, 1);
  assert.equal(r.classification.falsePositiveRate, 1);
});
test("failed documents remain in processing and missing-field denominators", () => {
  const c = fixture({
    automatic: { items: [] },
    predictedCategories: {},
    matches: { gold: null },
    processingStatus: "failed",
    processingMs: 200,
    error: "Malformed PDF",
  });
  const r = evaluateCorpus([fixture(), c]);
  assert.equal(r.processing.successRate, 0.5);
  assert.equal(r.processing.averageProcessingMs, 175);
  assert.equal(r.fields["items.quantity"].missingFieldRate, 0.5);
  assert.ok(r.frequentFailures.some((x) => x.failure === "Malformed PDF"));
});
test("delivery exact sets compare allocations independently of buyer address", () => {
  const c = fixture();
  c.truth.items[0].destinations = [
    { state: "Haryana", confirmed: true, quantity: "15" },
  ];
  c.automatic.items[0].destinations = [
    { state: "Punjab", confirmed: true, quantity: "15" },
  ];
  const m = evaluateCorpus([c]).fields["items.destinations"];
  assert.equal(m.missing, 1);
  assert.equal(m.spurious, 1);
});
test("OCR mistakes require explicit reviewer cause attribution", () => {
  const c = fixture({ methods: ["tesseract"] });
  c.automatic.items[0].quantity = null;
  assert.equal(evaluateCorpus([c]).documents[0].ocrRelatedMistakes, null);
  c.errorCauses = ["ocr"];
  assert.equal(evaluateCorpus([c]).documents[0].reviewerReportedOcrIssue, true);
  assert.equal(evaluateCorpus([c]).documents[0].ocrRelatedMistakes, null);
});
test("large explicit values compare exactly without floating-point loss", () => {
  const c = fixture();
  c.truth.estimatedValue = "9999999999999999";
  c.automatic.estimatedValue = "9999999999999998";
  assert.equal(evaluateCorpus([c]).fields.estimatedValue.incorrect, 1);
});
test("SYNTHETIC legacy missing categories/timing never become fabricated failures", () => {
  const r = evaluateCorpus([
    fixture({
      frozenCategoriesAvailable: false,
      processingStatus: "unrecorded",
      processingMs: null,
    }),
  ]);
  assert.equal(r.fields["items.category"], undefined);
  assert.equal(r.classification.documentsEvaluated, 0);
  assert.equal(r.classification.unmeasuredLegacyDocuments, 1);
  assert.equal(r.processing.recordedAttempts, 0);
  assert.equal(r.processing.successRate, null);
});
