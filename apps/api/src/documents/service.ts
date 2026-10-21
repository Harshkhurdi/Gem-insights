import { createHash, randomUUID } from "node:crypto";
import { promises as fs, constants } from "node:fs";
import { resolve, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { DataSource } from "typeorm";
import { HttpException } from "@nestjs/common";
import { z } from "zod";
import {
  extractTender,
  ExtractedPage,
  ExtractionDraft,
  stableItemKey,
} from "../../../../packages/core/pdf-extraction";
import { classify, validateTender } from "../../../../packages/core/domain";
import { Ingestion } from "../ingestion";
const run = promisify(execFile);
export const MAX_PDF_BYTES = 15 * 1024 * 1024,
  MAX_BATCH_BYTES = 100 * 1024 * 1024;
export const batchSchema = z
  .object({
    sourcePortal: z.literal("gem"),
    sourceName: z.string().trim().min(3).max(250),
    provenance: z.string().trim().min(10).max(2000),
    permissionNotes: z.string().trim().min(10).max(2000),
    authorizedProcessing: z.literal(true),
    retainContent: z.boolean(),
    retainEvidence: z.literal(true),
    allowOcr: z.boolean().default(false),
    maxFiles: z.number().int().min(1).max(500).default(20),
  })
  .strict();
export const reviewSchema = z
  .object({
    version: z.number().int().positive(),
    record: z.record(z.string(), z.unknown()),
    classifications: z
      .record(z.string(), z.string().max(100).nullable())
      .default({}),
    reason: z.string().trim().min(5).max(2000),
    completeSnapshot: z.boolean().default(false),
    reviewedAllPages: z.boolean().default(false),
    expectedTenderHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .default(null),
  })
  .strict();
const fail = (message: string, status = 400): never => {
  throw new HttpException(message, status);
};
export class Documents {
  constructor(
    private db: DataSource,
    private root = resolve(
      process.env.DOCUMENT_STORAGE_DIR || ".runtime/documents",
    ),
  ) {}
  private path(id: string, suffix = "pdf") {
    z.string().uuid().parse(id);
    return join(this.root, id + "." + suffix);
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  async createBatch(body: unknown) {
    const b = batchSchema.parse(body);
    const id = randomUUID();
    await this.db.query(
      "INSERT INTO document_batch(id,provenance,source_name,permission_notes,authorized_processing,retain_content,retain_evidence,allow_ocr,max_files,max_bytes) VALUES($1,$2,$3,$4,true,$5,true,$6,$7,$8)",
      [
        id,
        b.provenance,
        b.sourceName,
        b.permissionNotes,
        b.retainContent,
        b.allowOcr,
        b.maxFiles,
        b.maxFiles > 20 ? 2 * 1024 ** 3 : MAX_BATCH_BYTES,
      ],
    );
    return {
      id,
      maxFiles: b.maxFiles,
      maxFileBytes: MAX_PDF_BYTES,
      maxBatchBytes: b.maxFiles > 20 ? 2 * 1024 ** 3 : MAX_BATCH_BYTES,
    };
  }
  async upload(
    batchId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    sourceUrl?: string,
    reprocess = false,
  ) {
    z.string().uuid().parse(batchId);
    if (!file?.buffer?.length) fail("Choose one PDF file");
    if (file.buffer.length > MAX_PDF_BYTES)
      fail("PDF exceeds 15 MiB limit", 413);
    if (
      !/\.pdf$/i.test(file.originalname) ||
      !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
    )
      fail("Only genuine PDF files with a .pdf extension are accepted");
    if (sourceUrl)
      z.string()
        .url()
        .refine((s) => ["https:", "http:"].includes(new URL(s).protocol))
        .parse(sourceUrl);
    const sha = createHash("sha256").update(file.buffer).digest("hex");
    await this.init();
    let written: string | null = null;
    try {
      return await this.db.transaction(async (m) => {
        await m.query("SELECT pg_advisory_xact_lock(17924003)");
        const b = (
          await m.query("SELECT * FROM document_batch WHERE id=$1 FOR UPDATE", [
            batchId,
          ])
        )[0];
        if (!b) fail("Batch not found", 404);
        const old = (
          await m.query("SELECT * FROM upload_document WHERE sha256=$1", [sha])
        )[0];
        const linked =
          old &&
          (
            await m.query(
              "SELECT 1 FROM batch_document WHERE batch_id=$1 AND document_id=$2",
              [batchId, old.id],
            )
          ).length;
        if (!linked) {
          const usage = (
            await m.query(
              "SELECT count(*)::int AS files,COALESCE(sum(d.byte_size),0)::bigint AS bytes FROM batch_document b JOIN upload_document d ON d.id=b.document_id WHERE b.batch_id=$1",
              [batchId],
            )
          )[0];
          if (
            usage.files >= b.max_files ||
            Number(usage.bytes) + file.buffer.length > Number(b.max_bytes)
          )
            fail(
              `Batch exceeds ${b.max_files} files or ${Math.round(Number(b.max_bytes) / 1048576)} MiB; create another batch`,
              413,
            );
        }
        const id = old?.id || randomUUID();
        if (!old || reprocess) {
          if (old && !["failed", "needs_ocr", "cancelled"].includes(old.status))
            fail(
              "Only failed or OCR-needed documents can be reuploaded for reprocessing",
              409,
            );
          const active =
            old &&
            (
              await m.query(
                "SELECT 1 FROM job WHERE kind='pdf' AND payload->>'documentId'=$1 AND status IN ('pending','running')",
                [id],
              )
            ).length;
          if (active)
            fail("Document already has a pending processing job", 409);
          const pending = Number(
            (
              await m.query(
                "SELECT count(*) AS n FROM job WHERE kind='pdf' AND status IN ('pending','running')",
              )
            )[0].n,
          );
          if (pending >= 1000)
            fail(
              "PDF queue capacity reached (1,000). Wait for processing before uploading more.",
              429,
            );
          await fs.writeFile(this.path(id), file.buffer, {
            mode: 0o600,
            flag: old ? "w" : "wx",
          });
          written = id;
          if (old) {
            await m.query(
              "UPDATE upload_document SET status='queued',error=NULL,allow_ocr=$2,content_present=true,purge_after=now()+interval '24 hours' WHERE id=$1",
              [id, b.allow_ocr],
            );
          } else
            await m.query(
              "INSERT INTO upload_document(id,sha256,filename,byte_size,source_url,source_name,provenance,permission_notes,retain_content,retain_evidence,allow_ocr) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)",
              [
                id,
                sha,
                file.originalname
                  .replace(/[^a-zA-Z0-9._-]/g, "_")
                  .slice(0, 180),
                file.buffer.length,
                sourceUrl || null,
                b.source_name,
                b.provenance,
                b.permission_notes,
                b.retain_content,
                b.allow_ocr,
              ],
            );
          await m.query(
            "INSERT INTO job(id,kind,payload) VALUES($1,'pdf',$2)",
            [randomUUID(), JSON.stringify({ documentId: id })],
          );
        }
        await m.query(
          "INSERT INTO batch_document(batch_id,document_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [batchId, id],
        );
        return {
          id,
          sha256: sha,
          duplicate: !!old && !reprocess,
          status: old && !reprocess ? old.status : "queued",
          retention: old ? old.retain_content : b.retain_content,
        };
      });
    } catch (e) {
      if (written) await fs.rm(this.path(written), { force: true });
      throw e;
    }
  }
  async list(query: any = {}) {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(query.page || 1);
    const args: any[] = [];
    const clauses: string[] = [];
    if (query.batchId) {
      args.push(z.string().uuid().parse(query.batchId));
      clauses.push(
        `EXISTS(SELECT 1 FROM batch_document b WHERE b.document_id=d.id AND b.batch_id=$${args.length})`,
      );
    }
    if (query.status) {
      args.push(
        z
          .enum([
            "queued",
            "extracting",
            "review",
            "needs_ocr",
            "failed",
            "deferred",
            "rejected",
            "approved",
            "cancelled",
          ])
          .parse(query.status),
      );
      clauses.push(`d.status=$${args.length}`);
    }
    const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
    const data = await this.db.query(
      `SELECT d.*,x.version,x.warnings,x.approval_ready,count(*) OVER()::int AS total FROM upload_document d LEFT JOIN extraction_draft x ON x.document_id=d.id ${where} ORDER BY d.created_at DESC,d.id LIMIT 30 OFFSET $${args.length + 1}`,
      [...args, (page - 1) * 30],
    );
    const summary = (
      await this.db.query(
        `SELECT count(*)::int AS documents,count(*) FILTER(WHERE d.status='approved')::int AS approved_documents,count(DISTINCT d.tender_id)::int AS approved_tenders,COALESCE(array_agg(DISTINCT o.state) FILTER(WHERE o.state IS NOT NULL),'{}') AS buyer_states FROM upload_document d LEFT JOIN tender t ON t.id=d.tender_id LEFT JOIN organization o ON o.id=t.organization_id`,
      )
    )[0];
    return { data, total: data[0]?.total || 0, page, summary };
  }
  async detail(id: string) {
    z.string().uuid().parse(id);
    const d = (
      await this.db.query("SELECT * FROM upload_document WHERE id=$1", [id])
    )[0];
    if (!d) fail("Document not found", 404);
    const draft =
      (
        await this.db.query(
          "SELECT * FROM extraction_draft WHERE document_id=$1",
          [id],
        )
      )[0] || null;
    const current = draft?.record.bidNumber
      ? (
          await this.db.query(
            "SELECT id,current_hash,raw FROM tender WHERE source_portal='gem' AND bid_number=$1",
            [draft.record.bidNumber],
          )
        )[0] || null
      : null;
    return {
      ...d,
      draft,
      current,
      pages: await this.db.query(
        "SELECT page_number,method,text_content,character_count,readable FROM document_page WHERE document_id=$1 ORDER BY page_number",
        [id],
      ),
      reviews: await this.db.query(
        "SELECT action,reason,draft_version,record,classifications,created_at FROM extraction_review WHERE document_id=$1 ORDER BY created_at DESC LIMIT 50",
        [id],
      ),
    };
  }
  async file(id: string) {
    const d = await this.detail(id);
    if (!d.retain_content || !d.content_present)
      fail("Original PDF was not retained under this upload permission", 410);
    const handle = await fs.open(
      this.path(id),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }
  async process(id: string) {
    const d = await this.detail(id);
    if (
      ["approved", "rejected", "review", "deferred", "cancelled"].includes(
        d.status,
      )
    )
      return;
    if (!d.content_present)
      fail(
        d.error || "Temporary source deleted; explicitly reupload to reprocess",
        409,
      );
    const output = this.path(id, "extracted.json");
    const attemptId = randomUUID(),
      started = Date.now();
    let attemptStatus = "failed",
      attemptError: string | null = null;
    await this.db.query(
      "INSERT INTO document_attempt(id,document_id) VALUES($1,$2)",
      [attemptId, id],
    );
    await this.db.query(
      "UPDATE upload_document SET status='extracting',error=NULL WHERE id=$1",
      [id],
    );
    try {
      await run(
        process.execPath,
        [
          "--max-old-space-size=256",
          resolve("scripts/extract-pdf.mjs"),
          this.path(id),
          output,
          String(d.allow_ocr),
        ],
        { timeout: 120000, maxBuffer: 100000, env: { ...process.env } },
      );
      const extracted = JSON.parse(await fs.readFile(output, "utf8")) as {
        pages: ExtractedPage[];
      };
      if (!Array.isArray(extracted.pages) || extracted.pages.length > 80)
        throw new Error("Invalid extraction result");
      const rules = await this.db.query("SELECT * FROM product");
      const draft = extractTender(extracted.pages, d.source_url, rules);
      const existing = draft.record.bidNumber
        ? (
            await this.db.query(
              "SELECT raw FROM tender WHERE source_portal='gem' AND bid_number=$1",
              [draft.record.bidNumber],
            )
          )[0]?.raw
        : null;
      if (existing) {
        const original = existing.items || [];
        for (const i of draft.record.items) {
          const c = classify(i.name, rules);
          const matches = original.filter(
            (old: any) =>
              stableItemKey(old.name) === stableItemKey(i.name) ||
              (c.productId &&
                classify(old.name, rules).productId === c.productId),
          );
          const sameProduct = draft.record.items.filter(
            (n: any) =>
              c.productId && classify(n.name, rules).productId === c.productId,
          );
          if (
            matches.length === 1 &&
            (stableItemKey(matches[0].name) === stableItemKey(i.name) ||
              sameProduct.length === 1)
          ) {
            const previous = i.key;
            i.key = matches[0].key;
            draft.classifications[i.key] = draft.classifications[previous];
            if (i.key !== previous) {
              delete draft.classifications[previous];
              for (const field of Object.keys(draft.evidence).filter((k) =>
                k.startsWith("items." + previous),
              )) {
                draft.evidence[
                  field.replace("items." + previous, "items." + i.key)
                ] = draft.evidence[field];
                delete draft.evidence[field];
              }
              draft.warnings.push(
                "Existing source item key preserved for " +
                  i.name +
                  "; verify revision correspondence.",
              );
            }
          }
        }
        draft.warnings.push(
          "Existing tender detected. Review the complete current snapshot and any stored corrections before approval.",
        );
      }
      await this.db.transaction(async (m) => {
        await m.query(
          "INSERT INTO extraction_observation(id,document_id,parser_version,record,evidence,classifications,processing_ms,page_methods,attempt_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            randomUUID(),
            id,
            draft.parserVersion,
            JSON.stringify(draft.record),
            JSON.stringify(draft.evidence),
            JSON.stringify(draft.classifications),
            Date.now() - started,
            JSON.stringify([...new Set(extracted.pages.map((p) => p.method))]),
            attemptId,
          ],
        );
        await m.query("DELETE FROM document_page WHERE document_id=$1", [id]);
        for (const p of extracted.pages)
          await m.query("INSERT INTO document_page VALUES($1,$2,$3,$4,$5,$6)", [
            id,
            p.page,
            p.method,
            d.retain_content ? p.text : null,
            p.text.length,
            p.readable,
          ]);
        await m.query(
          "INSERT INTO extraction_draft(document_id,record,evidence,classifications,warnings,parser_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(document_id) DO UPDATE SET record=$2,evidence=$3,classifications=$4,warnings=$5,parser_version=$6,version=extraction_draft.version+1,updated_at=now()",
          [
            id,
            JSON.stringify(draft.record),
            JSON.stringify(draft.evidence),
            JSON.stringify(draft.classifications),
            JSON.stringify(draft.warnings),
            draft.parserVersion,
          ],
        );
        const unreadable = extracted.pages.some((p) => !p.readable);
        attemptStatus = unreadable ? "needs_ocr" : "succeeded";
        await m.query(
          "UPDATE upload_document SET status=$2,pages=$3,extraction_method=$4,extracted_at=now(),error=$5 WHERE id=$1",
          [
            id,
            unreadable ? "needs_ocr" : "review",
            extracted.pages.length,
            extracted.pages.some((p) => p.method === "tesseract")
              ? "embedded+tesseract"
              : "embedded",
            unreadable
              ? "One or more pages have insufficient readable text. OCR or manual source review is required."
              : null,
          ],
        );
      });
    } catch (e) {
      const error = (e as any).stderr?.trim() || (e as Error).message;
      attemptError = String(error)
        .replace(/[\u0000-\u0008\u001b]/g, "")
        .slice(0, 2000);
      await this.db.query(
        "UPDATE upload_document SET status='failed',error=$2 WHERE id=$1",
        [id, String(error).slice(0, 2000)],
      );
      throw new Error(String(error).slice(0, 2000));
    } finally {
      await this.db.query(
        "UPDATE document_attempt SET status=$2,finished_at=now(),processing_ms=$3,error=$4 WHERE id=$1",
        [attemptId, attemptStatus, Date.now() - started, attemptError],
      );
      await fs.rm(output, { force: true });
      if (!d.retain_content) {
        await fs.rm(this.path(id), { force: true });
        await this.db.query(
          "UPDATE upload_document SET content_present=false WHERE id=$1",
          [id],
        );
      }
    }
  }
  async review(
    id: string,
    action: "save" | "stage" | "approve" | "reject" | "defer",
    body: unknown,
  ) {
    z.string().uuid().parse(id);
    const b = reviewSchema.parse(body);
    if (JSON.stringify(b.record).length > 250000)
      fail("Reviewed record exceeds 250 KB");
    return this.db.transaction(async (m) => {
      const d = (
        await m.query("SELECT * FROM upload_document WHERE id=$1 FOR UPDATE", [
          id,
        ])
      )[0];
      if (!d) fail("Document not found", 404);
      const x = (
        await m.query(
          "SELECT * FROM extraction_draft WHERE document_id=$1 FOR UPDATE",
          [id],
        )
      )[0];
      if (!x) fail("No extraction draft is available", 409);
      if (d.status === "approved" && action === "approve")
        return { status: "approved", tenderId: d.tender_id, idempotent: true };
      if (!["review", "needs_ocr", "deferred"].includes(d.status))
        fail("Document cannot be reviewed in its current state", 409);
      if (x.version !== b.version)
        fail("Draft changed; reload before saving or approving", 409);
      let record = b.record as any,
        importResult: any = null,
        tenderId: string | null = null;
      if (action === "approve" || action === "stage") {
        if (!b.completeSnapshot || !b.reviewedAllPages)
          fail(
            "Explicitly confirm every source page and the complete tender snapshot",
          );
        record = validateTender(record);
        if (!record.items.every((i: any) => i.evidence?.trim()))
          fail("Every item requires source evidence");
        await m.query("SELECT pg_advisory_xact_lock(17924001)");
        const current = (
          await m.query(
            "SELECT current_hash FROM tender WHERE source_portal='gem' AND bid_number=$1",
            [record.bidNumber],
          )
        )[0];
        if ((current?.current_hash || null) !== b.expectedTenderHash)
          fail(
            "Production tender changed since review opened. Reload and reconcile the complete snapshot.",
            409,
          );
      }
      if (action === "approve") {
        record.documents = [
          ...(record.documents || []).filter(
            (v: any) => v.url !== record.sourceUrl,
          ),
          { url: record.sourceUrl, label: d.filename, sha256: d.sha256 },
        ];
        importResult = await new Ingestion(this.db).import(
          [record],
          d.provenance + "; PDF " + d.sha256 + "; reviewed: " + b.reason,
          "import",
          m,
        );
        tenderId = (
          await m.query(
            "SELECT id FROM tender WHERE source_portal='gem' AND bid_number=$1",
            [record.bidNumber],
          )
        )[0].id;
        for (const [key, productId] of Object.entries(b.classifications)) {
          const line = (
            await m.query(
              "SELECT id FROM line_item WHERE tender_id=$1 AND source_key=$2",
              [tenderId, key],
            )
          )[0];
          if (!line)
            fail(
              "Classification override references a missing stable item key",
            );
          if (productId) {
            const supported = (
              await m.query(
                "WITH RECURSIVE medical AS (SELECT id FROM category WHERE id='medical' UNION ALL SELECT c.id FROM category c JOIN medical a ON c.parent_id=a.id) SELECT 1 FROM product p WHERE id=$1 AND category_id IN (SELECT id FROM medical)",
                [productId],
              )
            ).length;
            if (!supported)
              fail("Choose a supported medical product or exclude this line");
          }
          await m.query(
            "INSERT INTO correction(id,tender_id,source_key,product_id,reason,actor) VALUES($1,$2,$3,$4,$5,$6)",
            [randomUUID(), tenderId, key, productId, b.reason, "administrator"],
          );
          await m.query(
            "UPDATE line_item SET product_id=$2,confidence=1,classification_reason=$3,needs_review=false WHERE id=$1",
            [line.id, productId, "Reviewed PDF classification: " + b.reason],
          );
        }
        await m.query(
          "UPDATE upload_document SET status='approved',approved_at=now(),tender_id=$2,import_run_id=$3,source_url=$4 WHERE id=$1",
          [id, tenderId, importResult.runId, record.sourceUrl],
        );
      } else if (!["save", "stage"].includes(action)) {
        await m.query("UPDATE upload_document SET status=$2 WHERE id=$1", [
          id,
          action === "reject" ? "rejected" : "deferred",
        ]);
      }
      await m.query(
        "UPDATE extraction_draft SET record=$2,manual_classifications=$3,version=version+1,updated_at=now(),approval_ready=$4,expected_tender_hash=$5 WHERE document_id=$1",
        [
          id,
          JSON.stringify(record),
          JSON.stringify(b.classifications),
          action === "stage",
          action === "stage" ? b.expectedTenderHash : null,
        ],
      );
      await m.query(
        "INSERT INTO extraction_review(id,document_id,action,reason,draft_version,record,classifications) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          id,
          action,
          b.reason,
          b.version,
          JSON.stringify(record),
          JSON.stringify(b.classifications),
        ],
      );
      return {
        status:
          action === "approve"
            ? "approved"
            : action === "reject"
              ? "rejected"
              : action === "defer"
                ? "deferred"
                : d.status,
        tenderId,
        import: importResult,
        version: b.version + 1,
      };
    });
  }
  async retry(id: string, allowOcr: boolean) {
    const d = await this.detail(id);
    if (!d.content_present)
      fail(
        "Source PDF was purged. Reupload the same PDF with retry enabled and the appropriate processing permission.",
        409,
      );
    if (!["failed", "needs_ocr", "cancelled"].includes(d.status))
      fail("Only failed or OCR-needed documents can be retried", 409);
    return this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(17924003)");
      const latest = (
        await m.query(
          "SELECT status,content_present FROM upload_document WHERE id=$1 FOR UPDATE",
          [id],
        )
      )[0];
      if (
        !latest?.content_present ||
        !["failed", "needs_ocr", "cancelled"].includes(latest.status)
      )
        fail("Document state changed; reload before retrying", 409);
      if (
        Number(
          (
            await m.query(
              "SELECT count(*) AS n FROM job WHERE kind='pdf' AND status IN ('pending','running')",
            )
          )[0].n,
        ) >= 1000
      )
        fail("PDF queue capacity reached (1,000)", 429);
      const active = (
        await m.query(
          "SELECT 1 FROM job WHERE kind='pdf' AND payload->>'documentId'=$1 AND status IN ('pending','running')",
          [id],
        )
      ).length;
      if (active) fail("Document processing is already pending", 409);
      await m.query(
        "UPDATE upload_document SET status='queued',allow_ocr=$2,error=NULL WHERE id=$1",
        [id, allowOcr],
      );
      const jobId = randomUUID();
      await m.query("INSERT INTO job(id,kind,payload) VALUES($1,'pdf',$2)", [
        jobId,
        JSON.stringify({ documentId: id }),
      ]);
      return { jobId };
    });
  }
  async batches() {
    return this.db.query(
      "SELECT b.id,b.source_name,b.created_at,b.max_files,b.max_bytes,count(d.id)::int AS documents,count(*) FILTER(WHERE d.status IN ('queued','extracting'))::int AS pending,count(*) FILTER(WHERE d.status='approved')::int AS approved,count(*) FILTER(WHERE d.status IN ('failed','needs_ocr'))::int AS failed,count(*) FILTER(WHERE x.approval_ready)::int AS ready FROM document_batch b LEFT JOIN batch_document l ON l.batch_id=b.id LEFT JOIN upload_document d ON d.id=l.document_id LEFT JOIN extraction_draft x ON x.document_id=d.id GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100",
    );
  }
  async approveBatch(id: string) {
    z.string().uuid().parse(id);
    const rows = await this.db.query(
      "SELECT d.id,x.version,x.record,x.manual_classifications,x.expected_tender_hash FROM batch_document b JOIN upload_document d ON d.id=b.document_id JOIN extraction_draft x ON x.document_id=d.id WHERE b.batch_id=$1 AND x.approval_ready AND d.status IN ('review','deferred','needs_ocr') ORDER BY d.id LIMIT 500",
      [id],
    );
    const outcomes = [];
    for (const r of rows)
      try {
        await this.review(r.id, "approve", {
          version: r.version,
          record: r.record,
          classifications: r.manual_classifications,
          expectedTenderHash: r.expected_tender_hash,
          reason:
            "Batch approval of individually reviewed and staged complete snapshot",
          completeSnapshot: true,
          reviewedAllPages: true,
        });
        outcomes.push({ id: r.id, status: "approved" });
      } catch (e) {
        outcomes.push({
          id: r.id,
          status: "blocked",
          error: (e as Error).message,
        });
      }
    return {
      attempted: rows.length,
      approved: outcomes.filter((o) => o.status === "approved").length,
      outcomes,
    };
  }
  async cancel(id: string) {
    z.string().uuid().parse(id);
    const d = await this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(17924003)");
      const d = (
        await m.query("SELECT * FROM upload_document WHERE id=$1 FOR UPDATE", [
          id,
        ])
      )[0];
      if (!d) fail("Document not found", 404);
      if (d.status !== "queued")
        fail("Only queued documents can be cancelled safely", 409);
      const jobs = await m.query(
        "UPDATE job SET status='cancelled',finished_at=now() WHERE kind='pdf' AND payload->>'documentId'=$1 AND status='pending' RETURNING id",
        [id],
      );
      if (!jobs.length)
        fail(
          "Worker has already claimed this document; wait for extraction to finish",
          409,
        );
      await m.query(
        "UPDATE upload_document SET status='cancelled',content_present=CASE WHEN retain_content THEN content_present ELSE false END WHERE id=$1",
        [id],
      );
      return d;
    });
    if (!d.retain_content) await fs.rm(this.path(id), { force: true });
    return { status: "cancelled" };
  }
  async purgeExpired() {
    await this.init();
    for (const name of await fs.readdir(this.root)) {
      const match = name.match(
        /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.(pdf|extracted\.json(?:\.page-\d+\.png)?)$/,
      );
      if (!match) continue;
      const path = join(this.root, name),
        stat = await fs.lstat(path);
      if (stat.mtimeMs > Date.now() - 86400000) continue;
      const owner = (
        await this.db.query(
          "SELECT retain_content FROM upload_document WHERE id=$1",
          [match[1]],
        )
      )[0];
      if (match[2] !== "pdf" || !owner || !owner.retain_content)
        await fs.rm(path, { force: true });
    }
    const rows = await this.db.query(
      "SELECT id FROM upload_document WHERE NOT retain_content AND content_present AND purge_after<now()",
    );
    for (const d of rows) {
      await fs.rm(this.path(d.id), { force: true });
      await this.db.query(
        "UPDATE upload_document SET content_present=false,status=CASE WHEN status IN ('queued','extracting') THEN 'failed' ELSE status END,error=CASE WHEN status IN ('queued','extracting') THEN 'Temporary PDF expired after 24 hours; reupload to process' ELSE error END WHERE id=$1",
        [d.id],
      );
    }
  }
}
