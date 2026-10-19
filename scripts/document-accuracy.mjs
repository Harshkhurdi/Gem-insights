// Aggregate-only calibration against operator-reviewed approved snapshots.
// It never downloads documents or exports source content.
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
const get = (o, path) => path.split(".").reduce((v, k) => v?.[k], o) ?? null;
try {
  await c.connect();
  const { rows } = await c.query(
    `SELECT d.id,d.source_name,d.provenance,o.record AS automatic,x.record AS reviewed FROM upload_document d JOIN extraction_draft x ON x.document_id=d.id JOIN LATERAL(SELECT record FROM extraction_observation WHERE document_id=d.id ORDER BY observed_at,id LIMIT 1)o ON true WHERE d.status='approved'`,
  );
  const fields = [
    "bidNumber",
    "title",
    "buyer.name",
    "buyer.department",
    "buyer.state",
    "buyer.district",
    "publishedAt",
    "closesAt",
    "estimatedValue",
  ];
  const counts = { compared: 0, matched: 0, missingAutomatically: 0 };
  let expectedItems = 0,
    automaticItems = 0,
    matchedItems = 0;
  for (const r of rows) {
    for (const path of fields) {
      const expected = get(r.reviewed, path),
        actual = get(r.automatic, path);
      if (expected === null && actual === null) continue;
      counts.compared++;
      if (JSON.stringify(expected) === JSON.stringify(actual)) counts.matched++;
      if (expected !== null && actual === null) counts.missingAutomatically++;
    }
    expectedItems += r.reviewed.items.length;
    automaticItems += r.automatic.items.length;
    for (const item of r.reviewed.items) {
      const original = r.automatic.items.find((i) => i.key === item.key);
      if (original) matchedItems++;
      for (const field of ["name", "quantity", "unit"]) {
        counts.compared++;
        if ((original?.[field] ?? null) === (item[field] ?? null))
          counts.matched++;
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        evaluatedApprovedDocuments: rows.length,
        syntheticDocuments: rows.filter((r) =>
          /SYNTHETIC|TEST ONLY/i.test(r.provenance),
        ).length,
        realDocuments: rows.filter(
          (r) => !/SYNTHETIC|TEST ONLY/i.test(r.provenance),
        ).length,
        fieldComparison: counts,
        fieldAgreementPercent: counts.compared
          ? Math.round((counts.matched / counts.compared) * 10000) / 100
          : null,
        lineItemPrecision: automaticItems
          ? matchedItems / automaticItems
          : null,
        lineItemRecall: expectedItems ? matchedItems / expectedItems : null,
        caveat:
          "Agreement with operator-reviewed approved snapshots, not an independently sampled external gold standard. Null/null pairs excluded. Synthetic fixtures do not establish real-world accuracy. No observations means accuracy is unmeasured.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
