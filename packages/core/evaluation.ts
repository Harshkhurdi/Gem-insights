import { unitName } from "./domain";

export const EVALUATION_VERSION = "explicit-matching-v1";
export const CORPUS_TAGS = [
  "patient-monitors",
  "ventilators",
  "ultrasound",
  "anaesthesia",
  "infusion-pumps",
  "syringe-pumps",
  "icu-beds",
  "x-ray",
  "surgical-lights",
  "laboratory",
  "text-pdf",
  "scanned",
  "multi-page",
  "multi-product",
  "multi-destination",
  "bilingual",
  "complex-table",
  "amendment",
  "missing-quantity",
  "negative-example",
];
export interface EvaluationInput {
  documentId: string;
  annotationVersion: number;
  observationId: string | null;
  parserVersion: string | null;
  realOriginal: boolean;
  automatic: any;
  truth: any;
  predictedCategories: Record<string, string | null>;
  frozenCategoriesAvailable?: boolean;
  truthCategories: Record<string, string | null>;
  matches: Record<string, string | null>;
  processingStatus: string;
  processingMs: number | null;
  methods: string[];
  error: string | null;
  errorCauses: string[];
  tags: string[];
}
const get = (o: any, path: string): any =>
  path.split(".").reduce((v, k) => v?.[k], o) ?? null;
const present = (v: any) =>
  v !== null && v !== undefined && v !== "" && v !== "unknown";
const norm = (v: any, kind = "text"): string | null => {
  if (!present(v)) return null;
  if (kind === "number") {
    const text = String(v).trim();
    if (!/^\d+(?:\.\d+)?$/.test(text)) return text;
    const [a, b = ""] = text.split(".");
    const fraction = b.replace(/0+$/, "");
    return (
      (a.replace(/^0+(?=\d)/, "") || "0") + (fraction ? "." + fraction : "")
    );
  }
  if (kind === "instant") {
    const n = Date.parse(v);
    return Number.isNaN(n) ? String(v) : String(n);
  }
  if (kind === "unit") return unitName(String(v));
  return String(v).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
};
function emptyMetric() {
  return {
    opportunities: 0,
    truthPresent: 0,
    predictedPresent: 0,
    correct: 0,
    incorrect: 0,
    missing: 0,
    spurious: 0,
    bothAbsent: 0,
    tp: 0,
    fp: 0,
    fn: 0,
  };
}
type Count = ReturnType<typeof emptyMetric>;
function finish(c: Count) {
  const denominator = c.correct + c.incorrect + c.missing + c.spurious;
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : null;
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : null;
  return {
    ...c,
    evaluated: denominator,
    precision,
    recall,
    f1: c.tp + c.fp + c.fn ? (2 * c.tp) / (2 * c.tp + c.fp + c.fn) : null,
    exactMatchAccuracy: denominator ? c.correct / denominator : null,
    missingFieldRate: c.truthPresent ? c.missing / c.truthPresent : null,
    humanCorrectionRate: denominator
      ? (c.incorrect + c.missing + c.spurious) / denominator
      : null,
  };
}
export function evaluateCorpus(all: EvaluationInput[]) {
  // Synthetic cases are excluded by explicit attestation, never inferred as real
  // from the absence of a test marker in provenance.
  const cases = all.filter((c) => c.realOriginal);
  const counts: Record<string, Count> = {};
  const documents: any[] = [];
  let matched = 0,
    predicted = 0,
    expected = 0,
    classNegatives = 0,
    classFalsePositive = 0;
  const failures: Record<string, number> = {};
  for (const c of cases) {
    const errors: any[] = [];
    const compare = (
      field: string,
      actual: any,
      truth: any,
      path = field,
      kind = "text",
    ) => {
      const a = norm(actual, kind),
        t = norm(truth, kind),
        n = (counts[field] ||= emptyMetric());
      n.opportunities++;
      if (t !== null) n.truthPresent++;
      if (a !== null) n.predictedPresent++;
      let outcome = "correct";
      if (t === null && a === null) {
        n.bothAbsent++;
        return;
      }
      if (t === a) {
        n.correct++;
        n.tp++;
        return;
      }
      if (t === null) {
        n.spurious++;
        n.fp++;
        outcome = "spurious";
      } else if (a === null) {
        n.missing++;
        n.fn++;
        outcome = "missing";
      } else {
        n.incorrect++;
        n.fp++;
        n.fn++;
        outcome = "incorrect";
      }
      errors.push({
        field,
        path,
        outcome,
        automatic: actual ?? null,
        groundTruth: truth ?? null,
      });
    };
    for (const path of [
      "bidNumber",
      "title",
      "publishedAt",
      "closesAt",
      "buyer.name",
      "buyer.state",
      "buyer.district",
      "estimatedValue",
    ])
      compare(
        path,
        get(c.automatic, path),
        get(c.truth, path),
        path,
        path === "closesAt"
          ? "instant"
          : path === "estimatedValue"
            ? "number"
            : "text",
      );
    const auto: any[] = c.automatic?.items || [],
      gold: any[] = c.truth?.items || [];
    compare("distinctLineItems", auto.length, gold.length, "items", "number");
    predicted += auto.length;
    expected += gold.length;
    const used = new Set<string>();
    for (const g of gold) {
      const key = c.matches[g.key];
      const p = key ? auto.find((i) => i.key === key) : undefined;
      if (p) {
        if (used.has(p.key))
          throw new Error("Line matching must be one-to-one");
        used.add(p.key);
        matched++;
      }
      for (const [field, kind] of [
        ["name", "text"],
        ["quantity", "number"],
        ["unit", "unit"],
        ["estimatedValue", "number"],
      ])
        compare(
          "items." + field,
          p?.[field],
          g[field],
          "items." + g.key + "." + field,
          kind,
        );
      const predictedCategory = p
        ? (c.predictedCategories[p.key] ?? null)
        : null;
      const trueCategory = c.truthCategories[g.key] ?? null;
      if (c.frozenCategoriesAvailable !== false)
        compare(
          "items.category",
          predictedCategory,
          trueCategory,
          "items." + g.key + ".category",
        );
      if (trueCategory === null && c.frozenCategoriesAvailable !== false) {
        classNegatives++;
        if (predictedCategory !== null) classFalsePositive++;
      }
      // Destination sets compare explicit state/district/city/allocated quantity.
      // Evidence quotes are not compared as facts. Buyer state is never substituted.
      const destinations = (item: any) =>
        (item?.destinations || [])
          .filter((d: any) => d.confirmed)
          .map((d: any) =>
            JSON.stringify([
              norm(d.state),
              norm(d.district),
              norm(d.city),
              norm(d.quantity, "number"),
            ]),
          )
          .sort();
      const a = destinations(p),
        t = destinations(g);
      const pool = [...a];
      for (const d of t) {
        const index = pool.indexOf(d);
        compare(
          "items.destinations",
          index >= 0 ? d : null,
          d,
          "items." + g.key + ".destinations",
        );
        if (index >= 0) pool.splice(index, 1);
      }
      for (const d of pool)
        compare(
          "items.destinations",
          d,
          null,
          "items." + g.key + ".destinations",
        );
    }
    for (const p of auto.filter((i) => !used.has(i.key))) {
      for (const [field, kind] of [
        ["name", "text"],
        ["quantity", "number"],
        ["unit", "unit"],
        ["estimatedValue", "number"],
      ])
        compare(
          "items." + field,
          p[field],
          null,
          "extra." + p.key + "." + field,
          kind,
        );
      if (c.frozenCategoriesAvailable !== false)
        compare(
          "items.category",
          c.predictedCategories[p.key],
          null,
          "extra." + p.key + ".category",
        );
      if (c.frozenCategoriesAvailable !== false) {
        classNegatives++;
        if (c.predictedCategories[p.key] != null) classFalsePositive++;
      }
      for (const d of (p.destinations || []).filter((d: any) => d.confirmed))
        compare(
          "items.destinations",
          JSON.stringify(d),
          null,
          "extra." + p.key + ".destinations",
        );
    }
    if (c.error)
      failures[c.error.slice(0, 200)] =
        (failures[c.error.slice(0, 200)] || 0) + 1;
    for (const e of errors)
      failures[e.field + ": " + e.outcome] =
        (failures[e.field + ": " + e.outcome] || 0) + 1;
    documents.push({
      documentId: c.documentId,
      annotationVersion: c.annotationVersion,
      observationId: c.observationId,
      parserVersion: c.parserVersion,
      processingStatus: c.processingStatus,
      processingMs: c.processingMs,
      methods: c.methods,
      tags: c.tags,
      lineItems: {
        automatic: auto.length,
        groundTruth: gold.length,
        matched: used.size,
      },
      errors,
      errorCauses: c.errorCauses,
      reviewerReportedOcrIssue: c.errorCauses.includes("ocr"),
      ocrRelatedMistakes: null,
      ocrDocument: c.methods.includes("tesseract"),
    });
  }
  const sample = cases.length,
    processed = cases.filter((c) => c.processingStatus === "succeeded").length;
  const recordedAttempts = cases.filter(
    (c) => c.processingStatus !== "unrecorded",
  ).length;
  const times = cases
    .map((c) => c.processingMs)
    .filter((n): n is number => n !== null);
  const fields = Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, finish(v)]),
  );
  const total = Object.values(counts).reduce((sum, c) => {
    for (const k of Object.keys(sum) as (keyof Count)[]) sum[k] += c[k];
    return sum;
  }, emptyMetric());
  return {
    methodology: EVALUATION_VERSION,
    status:
      sample === 0
        ? "Not yet measured"
        : sample < 50
          ? "Limited sample — descriptive results only"
          : "Measured on selected reviewed corpus",
    targetDocuments: 50,
    documentsEvaluated: sample,
    excludedSyntheticDocuments: all.length - sample,
    processing: {
      documents: sample,
      recordedAttempts,
      unrecorded: sample - recordedAttempts,
      successfullyProcessed: processed,
      successRate: recordedAttempts ? processed / recordedAttempts : null,
      timedDocuments: times.length,
      averageProcessingMs: times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : null,
    },
    fields,
    overall: finish(total),
    lineItemMatching: {
      method:
        "Explicit one-to-one ground-truth key → parser key; null means missing, unused predictions are false positives",
      matched,
      predicted,
      expected,
      precision: predicted ? matched / predicted : null,
      recall: expected ? matched / expected : null,
      f1: predicted + expected ? (2 * matched) / (predicted + expected) : null,
    },
    classification: {
      documentsEvaluated: cases.filter(
        (c) => c.frozenCategoriesAvailable !== false,
      ).length,
      unmeasuredLegacyDocuments: cases.filter(
        (c) => c.frozenCategoriesAvailable === false,
      ).length,
      negativeOpportunities: classNegatives,
      falsePositives: classFalsePositive,
      falsePositiveRate: classNegatives
        ? classFalsePositive / classNegatives
        : null,
    },
    ocr: {
      documents: cases.filter((c) => c.methods.includes("tesseract")).length,
      documentsWithReviewedOcrErrors: cases.filter((c) =>
        c.errorCauses.includes("ocr"),
      ).length,
      caveat:
        "Reviewer labels identify documents with OCR issues. Field-level OCR-caused mistake counts are not measured; other errors in those documents must not all be attributed to OCR.",
    },
    frequentFailures: Object.entries(failures)
      .map(([failure, count]) => ({ failure, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30),
    documents,
    caveat:
      "Explicitly attested real originals with approved annotations only. Null/null fields excluded from accuracy. Each metric exposes its denominator. Selected-corpus results are not national or out-of-sample performance. Classifications and parser versions are frozen at extraction; legacy observations without frozen categories are excluded from category metrics, and unrecorded processing attempts are excluded from success-rate/timing denominators.",
  };
}
