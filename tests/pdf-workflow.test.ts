import { Documents, MAX_PDF_BYTES } from "../apps/api/src/documents/service";
import { migrations } from "../apps/api/src/migrations";
import "reflect-metadata";
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { DataSource } from "typeorm";
import { Ingestion } from "../apps/api/src/ingestion";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { makePdf, sampleText } from "./pdf-fixtures";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("PDF integration tests require isolated _test database");
const db = new DataSource({
  type: "postgres",
  url,
  migrations,
  synchronize: false,
});
let root: string, documents: Documents;
const a = new Analytics(db);
const settings = {
  sourcePortal: "gem",
  sourceName: "SYNTHETIC TEST source",
  provenance: "SYNTHETIC PDF TEST DATA ONLY",
  permissionNotes: "Generated test fixture; testing rights only",
  authorizedProcessing: true,
  retainContent: false,
  retainEvidence: true,
  allowOcr: false,
};
async function uploaded(text = sampleText(), retain = false) {
  const b = await documents.createBatch({ ...settings, retainContent: retain });
  return documents.upload(
    b.id,
    {
      buffer: makePdf([text]),
      originalname: "synthetic-test.pdf",
      mimetype: "application/pdf",
    },
    "https://example.org/synthetic-test.pdf",
  );
}
async function approval(id: string, extra: any = {}) {
  const d = await documents.detail(id);
  return {
    version: d.draft.version,
    record: d.draft.record,
    classifications: {},
    reason: "Reviewed synthetic source fixture",
    completeSnapshot: true,
    reviewedAllPages: true,
    expectedTenderHash: d.current?.current_hash || null,
    ...extra,
  };
}
before(async () => {
  await db.initialize();
  await db.runMigrations();
  await fs.mkdir(".runtime", { recursive: true });
  root = await fs.mkdtemp(resolve(".runtime/pdf-tests-"));
  documents = new Documents(db, root);
});
after(async () => {
  if (db.isInitialized) await db.destroy();
  await fs.rm(root, { recursive: true, force: true });
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE upload_document,document_batch,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
});
test("authorized PDF -> embedded extraction -> reviewed import -> analytics", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const d = await documents.detail(up.id);
  assert.equal(d.status, "review");
  assert.equal(d.pages[0].method, "embedded");
  assert.equal(d.draft.record.items[0].quantity, "12");
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 0);
  await documents.review(up.id, "approve", await approval(up.id));
  const stats = await a.overview(filterSchema.parse({}));
  assert.equal(stats.tenders, 1);
  assert.equal(
    (await a.products(filterSchema.parse({})))[0].quantities.units,
    12,
  );
});
test("nonretained PDF bytes and full page text are purged, minimal evidence remains", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const d = await documents.detail(up.id);
  assert.equal(d.content_present, false);
  assert.equal(d.pages[0].text_content, null);
  assert.ok(d.draft.evidence.bidNumber[0].quote);
  await assert.rejects(fs.stat(resolve(root, up.id + ".pdf")));
  await assert.rejects(documents.file(up.id));
});
test("retained originals are private and readable only through the guarded service", async () => {
  const up = await uploaded(sampleText(), true);
  await documents.process(up.id);
  const d = await documents.detail(up.id);
  assert.equal(d.content_present, true);
  assert.ok(d.pages[0].text_content.includes("SYNTHETIC TEST ONLY"));
  assert.equal(
    (await documents.file(up.id)).subarray(0, 5).toString(),
    "%PDF-",
  );
});
test("duplicate bytes with different filenames produce one document and one job", async () => {
  const b = await documents.createBatch(settings);
  const file = {
    buffer: makePdf([sampleText()]),
    originalname: "one.pdf",
    mimetype: "application/pdf",
  };
  const one = await documents.upload(b.id, file),
    two = await documents.upload(b.id, { ...file, originalname: "two.pdf" });
  assert.equal(one.id, two.id);
  assert.equal(two.duplicate, true);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM job WHERE kind='pdf'"))[0].n,
    1,
  );
});
test("malformed PDF fails independently and valid batch members still extract", async () => {
  const b = await documents.createBatch(settings);
  const bad = await documents.upload(b.id, {
    buffer: Buffer.from("%PDF-1.7 broken test fixture"),
    originalname: "broken.pdf",
    mimetype: "application/pdf",
  });
  const good = await documents.upload(b.id, {
    buffer: makePdf([sampleText()]),
    originalname: "good.pdf",
    mimetype: "application/pdf",
  });
  await assert.rejects(documents.process(bad.id));
  await documents.process(good.id);
  assert.equal((await documents.detail(bad.id)).status, "failed");
  assert.equal((await documents.detail(good.id)).status, "review");
});
test("scanned or blank pages explicitly require OCR or manual source review", async () => {
  const up = await uploaded("");
  await documents.process(up.id);
  assert.equal((await documents.detail(up.id)).status, "needs_ocr");
  await assert.rejects(
    documents.review(up.id, "approve", await approval(up.id)),
  );
});
test("required processing and minimal-evidence permission are enforced", async () => {
  await assert.rejects(
    documents.createBatch({ ...settings, authorizedProcessing: false }),
  );
  await assert.rejects(
    documents.createBatch({ ...settings, retainEvidence: false }),
  );
});
test("forged files and oversized files are rejected before storage", async () => {
  const b = await documents.createBatch(settings);
  await assert.rejects(
    documents.upload(b.id, {
      buffer: Buffer.from("not a PDF"),
      originalname: "bad.pdf",
      mimetype: "application/pdf",
    }),
  );
  await assert.rejects(
    documents.upload(b.id, {
      buffer: Buffer.alloc(MAX_PDF_BYTES + 1),
      originalname: "large.pdf",
      mimetype: "application/pdf",
    }),
  );
  assert.equal((await documents.list()).summary.documents, 0);
});
test("unknown quantities remain null after explicit full-snapshot approval", async () => {
  const text = sampleText()
    .replace("Patient monitor ( 12 pieces )", "Patient monitor ( 12 pieces )")
    .replace("Total Quantity: 12", "Total Quantity: unknown");
  const up = await uploaded(text);
  await documents.process(up.id);
  const b = await approval(up.id);
  b.record.items[0].quantity = null;
  b.record.items[0].destinations = [];
  await documents.review(up.id, "approve", b);
  assert.equal(
    (await a.products(filterSchema.parse({})))[0].quantities.units,
    null,
  );
});
test("incomplete drafts and partial approvals never reach production", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  await assert.rejects(
    documents.review(
      up.id,
      "approve",
      await approval(up.id, { completeSnapshot: false }),
    ),
  );
  const incomplete = await approval(up.id);
  incomplete.record.buyer.key = null;
  await assert.rejects(documents.review(up.id, "approve", incomplete));
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 0);
  assert.equal((await documents.detail(up.id)).status, "review");
});
test("duplicate approval is idempotent and approval status matches imported tender", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  await documents.review(up.id, "approve", b);
  const again = await documents.review(up.id, "approve", b);
  assert.equal(again.idempotent, true);
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 1);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM tender_version"))[0].n,
    1,
  );
});
test("manual overrides persist when saving a draft and after source amendments", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  const key = b.record.items[0].key;
  b.classifications = { [key]: "icu-ventilators" };
  await documents.review(up.id, "save", b);
  assert.equal(
    (await documents.detail(up.id)).draft.manual_classifications[key],
    "icu-ventilators",
  );
  const approve = await approval(up.id, { classifications: b.classifications });
  await documents.review(up.id, "approve", approve);
  const revised = await uploaded(sampleText({ quantity: "20" }));
  await documents.process(revised.id);
  const next = await approval(revised.id);
  assert.equal(next.record.items[0].key, key);
  await documents.review(revised.id, "approve", next);
  const products = await a.products(filterSchema.parse({}));
  assert.equal(products[0].product_id, "icu-ventilators");
  assert.equal(products[0].quantities.units, 20);
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 1);
});
test("legacy stable line keys and corrections survive PDF-based revisions", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const original = (await approval(up.id)).record;
  original.items[0].key = "legacy-monitor-line";
  await new Ingestion(db).import([original], "SYNTHETIC LEGACY IMPORT");
  const line = (await db.query("SELECT id FROM line_item"))[0];
  await new Ingestion(db).correct(
    line.id,
    "icu-ventilators",
    "SYNTHETIC retained correction",
  );
  const next = await uploaded(sampleText({ quantity: "25" }));
  await documents.process(next.id);
  const b = await approval(next.id);
  assert.equal(b.record.items[0].key, "legacy-monitor-line");
  await documents.review(next.id, "approve", b);
  assert.equal(
    (await a.products(filterSchema.parse({})))[0].product_id,
    "icu-ventilators",
  );
});
test("stale draft versions cannot overwrite review corrections", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  await documents.review(up.id, "save", b);
  await assert.rejects(documents.review(up.id, "approve", b));
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 0);
});
test("concurrent production changes force full-snapshot reconciliation", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  await new Ingestion(db).import([b.record], "SYNTHETIC concurrent import");
  await assert.rejects(documents.review(up.id, "approve", b));
  assert.equal((await documents.detail(up.id)).status, "review");
});
test("approval and importer roll back together on invalid classification", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  b.classifications = { [b.record.items[0].key]: "does-not-exist" };
  await assert.rejects(documents.review(up.id, "approve", b));
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 0);
  assert.equal((await documents.detail(up.id)).status, "review");
});
test("reject and defer are audited and do not add demand", async () => {
  const one = await uploaded();
  await documents.process(one.id);
  await documents.review(one.id, "defer", await approval(one.id));
  assert.equal((await documents.detail(one.id)).status, "deferred");
  await documents.review(one.id, "reject", await approval(one.id));
  assert.equal((await documents.detail(one.id)).reviews[0].action, "reject");
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, 0);
});
test("multi-destination quantities are allocated once per confirmed state", async () => {
  const up = await uploaded(
    sampleText().replace(
      "Delivery State: Punjab; District: Mohali; Quantity: 12",
      "Delivery State: Punjab; District: Mohali; Quantity: 7\nDelivery State: Haryana; District: Panchkula; Quantity: 5",
    ),
  );
  await documents.process(up.id);
  await documents.review(up.id, "approve", await approval(up.id));
  const s = await a.states(filterSchema.parse({ basis: "delivery" }));
  assert.equal(s.find((r: any) => r.state === "Punjab").quantities.units, 7);
  assert.equal(s.find((r: any) => r.state === "Haryana").quantities.units, 5);
});
test("expired nonretained uploads are purged before extraction", async () => {
  const up = await uploaded();
  await db.query(
    "UPDATE upload_document SET purge_after=now()-interval '1 minute' WHERE id=$1",
    [up.id],
  );
  await documents.purgeExpired();
  const d = await documents.detail(up.id);
  assert.equal(d.content_present, false);
  assert.equal(d.status, "failed");
  await assert.rejects(documents.retry(up.id, true));
});
test("same bytes can be explicitly reuploaded for processing after ephemeral purge", async () => {
  const up = await uploaded("");
  await documents.process(up.id);
  await db.query("UPDATE job SET status='succeeded' WHERE kind='pdf'");
  const b = await documents.createBatch(settings);
  const next = await documents.upload(
    b.id,
    {
      buffer: makePdf([""]),
      originalname: "reuploaded.pdf",
      mimetype: "application/pdf",
    },
    undefined,
    true,
  );
  assert.equal(next.id, up.id);
  assert.equal(next.status, "queued");
});

test("original extraction observations remain unchanged after reviewer correction", async () => {
  const up = await uploaded();
  await documents.process(up.id);
  const b = await approval(up.id);
  b.record.title = "Human-verified synthetic title correction";
  await documents.review(up.id, "save", b);
  const o = (
    await db.query(
      "SELECT record FROM extraction_observation WHERE document_id=$1",
      [up.id],
    )
  )[0];
  assert.equal(o.record.title, "SYNTHETIC TEST equipment procurement");
  assert.equal(
    (await documents.detail(up.id)).draft.record.title,
    "Human-verified synthetic title correction",
  );
});
test("batch file limit is enforced server-side independently of the browser", async () => {
  const b = await documents.createBatch(settings);
  for (let n = 0; n < 20; n++)
    await documents.upload(b.id, {
      buffer: makePdf([sampleText({ bid: "GEM/2026/B/" + (9900000 + n) })]),
      originalname: "test.pdf",
      mimetype: "application/pdf",
    });
  await assert.rejects(
    documents.upload(b.id, {
      buffer: makePdf([sampleText({ bid: "GEM/2026/B/9999999" })]),
      originalname: "extra.pdf",
      mimetype: "application/pdf",
    }),
  );
  assert.equal((await documents.list()).summary.documents, 20);
});
test("orphaned temporary bytes expire without deleting permitted retained originals", async () => {
  const orphan = "00000000-0000-4000-8000-000000000001.pdf";
  await fs.writeFile(resolve(root, orphan), makePdf([sampleText()]));
  const old = new Date(Date.now() - 2 * 86400000);
  await fs.utimes(resolve(root, orphan), old, old);
  await documents.purgeExpired();
  await assert.rejects(fs.stat(resolve(root, orphan)));
});

test("optional OCR reports a missing local engine without sending source data elsewhere", async () => {
  const original = process.env.PDFTOPPM_BIN;
  process.env.PDFTOPPM_BIN = "/definitely-missing-local-ocr-binary";
  try {
    const b = await documents.createBatch({ ...settings, allowOcr: true });
    const up = await documents.upload(b.id, {
      buffer: makePdf([""]),
      originalname: "synthetic-scan.pdf",
      mimetype: "application/pdf",
    });
    await assert.rejects(
      documents.process(up.id),
      /Local OCR tools are missing/,
    );
    const d = await documents.detail(up.id);
    assert.equal(d.status, "failed");
    assert.equal(d.content_present, false);
  } finally {
    if (original === undefined) delete process.env.PDFTOPPM_BIN;
    else process.env.PDFTOPPM_BIN = original;
  }
});
