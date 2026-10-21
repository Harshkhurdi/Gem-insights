import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { Collection } from "../apps/api/src/collection/service";
import { NoticeDocuments } from "../apps/api/src/collection/document-fetch";
import { Documents } from "../apps/api/src/documents/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { makePdf, sampleText } from "./pdf-fixtures";
import { raipur } from "./collection-fixtures";
import { promises as fs } from "node:fs";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations });
const storage = ".runtime/notice-document-tests";
const documents = new Documents(db, storage);
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
  await fs.rm(storage, { force: true, recursive: true });
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot,upload_document,document_batch CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=true,checkpoint=NULL WHERE id='aiims-raipur'",
  );
});
async function notice(gem = true) {
  await new Collection(
    db,
    async () =>
      raipur(
        "SYNTHETIC ICU ventilators",
        "",
        gem ? "GEM/2026/B/9990001" : "SYNTHETIC/NATIVE",
      ),
    0,
  ).run("aiims-raipur");
  return (await db.query("SELECT * FROM discovered_notice"))[0];
}
const payload = (n: any) => ({
  noticeId: n.id,
  expectedHash: n.current_hash,
  documentIndex: 0,
});
test("linked original PDF queues once and extracts real fields locally before analytics", async () => {
  const n = await notice(),
    service = new NoticeDocuments(
      db,
      async () => makePdf([sampleText({ bid: "GEM/2026/B/9990001" })]),
      documents,
    );
  assert.ok((await service.queue(n.id, n.current_hash, 0)).jobId);
  assert.equal(
    (await service.queue(n.id, n.current_hash, 0)).status,
    "already_pending",
  );
  const r = await service.process(payload(n));
  await documents.process(r.documentId);
  const detail = await new Collection(db).detail(n.id);
  assert.equal(detail.extractedDocuments.length, 1);
  assert.equal(detail.extractedDocuments[0].status, "review");
  assert.equal(detail.extractedDocuments[0].draft_record.items.length, 1);
  assert.equal(
    (await new Analytics(db).overview(filterSchema.parse({}))).tenders,
    0,
  );
  assert.equal(
    (await service.queue(n.id, n.current_hash, 0)).documentId,
    r.documentId,
  );
});
test("stale notices, native formats and unavailable indexes fail before downloading", async () => {
  let downloads = 0;
  const service = new NoticeDocuments(
    db,
    async () => {
      downloads++;
      return Buffer.from("%PDF-");
    },
    documents,
  );
  const n = await notice();
  await assert.rejects(service.queue(n.id, "a".repeat(64), 0), /changed/);
  await assert.rejects(
    service.queue(n.id, n.current_hash, 99),
    /Choose an HTTPS/,
  );
  await db.query(
    "UPDATE discovered_notice SET source_portal='institution' WHERE id=$1",
    [n.id],
  );
  await assert.rejects(service.process(payload(n)), /GeM-format/);
  assert.equal(downloads, 0);
});
test("cross-host document redirects cannot be queued from imported discovery metadata", async () => {
  const n = await notice();
  await db.query("UPDATE discovered_notice SET documents=$2 WHERE id=$1", [
    n.id,
    JSON.stringify(["https://evil.example/test.pdf"]),
  ]);
  await assert.rejects(
    new NoticeDocuments(db).queue(n.id, n.current_hash, 0),
    /official host/,
  );
});
test("source changes during download do not create extraction jobs", async () => {
  const n = await notice();
  const service = new NoticeDocuments(
    db,
    async () => {
      await db.query(
        "UPDATE discovered_notice SET current_hash=$2 WHERE id=$1",
        [n.id, "b".repeat(64)],
      );
      return makePdf([sampleText()]);
    },
    documents,
  );
  await assert.rejects(service.process(payload(n)), /changed/);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM upload_document"))[0].n,
    0,
  );
});
