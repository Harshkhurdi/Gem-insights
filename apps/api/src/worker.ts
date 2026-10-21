import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { connect, db } from "./database";
import { Documents } from "./documents/service";
import { Ingestion } from "./ingestion";
import { classify } from "../../../packages/core/domain";
import { Collection } from "./collection/service";
import { NoticeDocuments } from "./collection/document-fetch";
const noticeDocuments = new NoticeDocuments(db);
const collection = new Collection(db);
const ingest = new Ingestion(db);
const documents = new Documents(db);
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function collect() {
  if (
    process.env.FEED_AUTHORIZED !== "true" ||
    !process.env.AUTHORIZED_FEED_URL
  )
    throw new Error("Authorized feed not configured");
  const base = new URL(process.env.AUTHORIZED_FEED_URL);
  if (base.protocol !== "https:")
    throw new Error("Authorized feed must use HTTPS");
  let cursor =
    (await db.query("SELECT checkpoint FROM source WHERE id='import'"))[0]
      ?.checkpoint || "";
  const seenCursors = new Set<string>();
  if (cursor) seenCursors.add(cursor);
  for (let page = 0; page < 100 && !stopping; page++) {
    const u = new URL(base);
    if (cursor) u.searchParams.set("cursor", cursor);
    const r = await fetch(u, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(`Feed returned HTTP ${r.status}`);
    const reader = r.body!.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 5e6) {
        await reader.cancel();
        throw new Error("Feed page exceeds 5MB");
      }
      chunks.push(part.value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!Array.isArray(data.records))
      throw new Error("Feed records array missing");
    const next = data.nextCursor;
    if (next != null && (typeof next !== "string" || next.length > 2048))
      throw new Error("Invalid cursor");
    if (next && seenCursors.has(next))
      throw new Error("Non-advancing or cyclic cursor");
    if (next) seenCursors.add(next);
    if (data.records.length)
      await ingest.import(data.records, "Authorized feed " + base.origin);
    cursor = next || "";
    await db.query("UPDATE source SET checkpoint=$1 WHERE id='import'", [
      cursor || null,
    ]);
    if (!next) return;
    await delay(Math.max(1000, Number(process.env.FEED_PAGE_DELAY_MS) || 5000));
  }
  throw new Error("Page budget reached; checkpoint retained for next run");
}
async function reclassify() {
  await db.transaction(async (m) => {
    await m.query("SELECT pg_advisory_xact_lock(17924001)");
    const rules = await m.query("SELECT * FROM product");
    let after = "00000000-0000-0000-0000-000000000000";
    while (true) {
      const items = await m.query(
        "SELECT l.* FROM line_item l WHERE l.id>$1 AND NOT EXISTS(SELECT 1 FROM correction c WHERE c.tender_id=l.tender_id AND c.source_key=l.source_key) ORDER BY l.id LIMIT 500",
        [after],
      );
      if (!items.length) break;
      for (const item of items) {
        const c = classify(item.original_name, rules);
        await m.query(
          "UPDATE line_item SET product_id=$2,confidence=$3,classification_reason=$4,needs_review=$5 WHERE id=$1",
          [item.id, c.productId, c.confidence, c.reason, c.review],
        );
      }
      after = items.at(-1).id;
    }
  });
}
async function start() {
  await connect();
  const lock = db.createQueryRunner();
  await lock.connect();
  let ownsLock = false;
  try {
    ownsLock = (
      await lock.query("SELECT pg_try_advisory_lock(17924002) AS locked")
    )[0].locked;
    if (!ownsLock) throw new Error("Another worker owns the scheduler lock");
    await db.query(
      "UPDATE document_attempt SET status='interrupted',finished_at=now(),processing_ms=LEAST(2147483647,EXTRACT(EPOCH FROM(now()-started_at))*1000)::integer,error='Worker interrupted before extraction completed' WHERE status='running'",
    );
    await db.query(
      "UPDATE job SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,available_at=now() WHERE status='running'",
    );
    await db.query(
      "UPDATE collection_run SET status='interrupted',finished_at=now(),error='Worker restarted; next run resumes saved checkpoint' WHERE status='running'",
    );
    await documents.purgeExpired();
    let lastPurge = Date.now();
    let lastScheduled = Date.now();
    let lastCollectionSchedule = 0;
    while (!stopping) {
      if (
        process.env.COLLECTION_ENABLED !== "false" &&
        Date.now() - lastCollectionSchedule >= 30000
      ) {
        await collection.schedule();
        lastCollectionSchedule = Date.now();
      }
      if (Date.now() - lastPurge > 60000) {
        await documents.purgeExpired();
        lastPurge = Date.now();
      }
      if (
        process.env.FEED_AUTHORIZED === "true" &&
        process.env.AUTHORIZED_FEED_URL &&
        Date.now() - lastScheduled >=
          Math.max(300000, Number(process.env.SYNC_INTERVAL_MS) || 3600000)
      ) {
        await db.query(
          "INSERT INTO job(id,kind,payload) VALUES($1,'feed','{}') ON CONFLICT DO NOTHING",
          [randomUUID()],
        );
        lastScheduled = Date.now();
      }
      const j = await db.transaction(async (m) => {
        const rows = await m.query(
          "SELECT * FROM job WHERE status='pending' AND available_at<=now() ORDER BY CASE WHEN kind IN ('pdf','notice-pdf','import','classify') THEN 0 ELSE 1 END,created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        );
        if (!rows[0]) return null;
        await m.query(
          "UPDATE job SET status='running',locked_at=now(),attempts=attempts+1 WHERE id=$1",
          [rows[0].id],
        );
        return rows[0];
      });
      if (!j) {
        await delay(1500);
        continue;
      }
      try {
        if (j.kind === "import")
          await ingest.import(j.payload.records, j.payload.provenance);
        else if (j.kind === "feed") await collect();
        else if (j.kind === "collect")
          await collection.run(j.payload.sourceId, () => stopping);
        else if (j.kind === "notice-pdf")
          await noticeDocuments.process(j.payload);
        else if (j.kind === "pdf")
          await documents.process(j.payload.documentId);
        else if (j.kind === "classify") await reclassify();
        else throw new Error("Unsupported job kind");
        await db.query(
          "UPDATE job SET status='succeeded',finished_at=now() WHERE id=$1",
          [j.id],
        );
        await db.query(
          "INSERT INTO analytics_snapshot(id,metrics) SELECT $1,jsonb_build_object('tenders',count(*),'coverage','partial') FROM tender",
          [randomUUID()],
        );
        console.log(JSON.stringify({ job: j.id, status: "succeeded" }));
      } catch (e) {
        const attempt = j.attempts + 1;
        await db.query(
          "UPDATE job SET status=$2,last_error=$3,available_at=now()+($4::text||' seconds')::interval WHERE id=$1",
          [
            j.id,
            attempt >= 3 || j.kind === "pdf" ? "failed" : "pending",
            (e as Error).message.slice(0, 2000),
            Math.min(300, 2 ** attempt * 5),
          ],
        );
        console.error(
          JSON.stringify({
            job: j.id,
            status: "failed",
            attempt,
            error: (e as Error).message,
          }),
        );
      }
    }
  } finally {
    try {
      if (ownsLock) await lock.query("SELECT pg_advisory_unlock(17924002)");
    } finally {
      await lock.release();
      await db.destroy();
    }
  }
}
start().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
