import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { HttpException } from "@nestjs/common";
import { z } from "zod";
import {
  CORPUS_TAGS,
  evaluateCorpus,
  EvaluationInput,
} from "../../../../packages/core/evaluation";

const label = z.string().max(2000).nullable().optional();
const recordSchema = z
  .object({
    bidNumber: label,
    title: label,
    publishedAt: label,
    closesAt: label,
    estimatedValue: label,
    buyer: z
      .object({ name: label, state: label, district: label })
      .passthrough(),
    items: z
      .array(
        z
          .object({
            key: z.string().min(1).max(150),
            name: z.string().min(1).max(2000),
            quantity: label,
            unit: label,
            estimatedValue: label,
            destinations: z
              .array(
                z
                  .object({
                    state: z.string().min(1).max(200),
                    district: label,
                    city: label,
                    quantity: label,
                    confirmed: z.boolean(),
                  })
                  .passthrough(),
              )
              .max(100)
              .default([]),
          })
          .passthrough(),
      )
      .max(1000),
  })
  .passthrough();
const annotationSchema = z
  .object({
    version: z.number().int().positive(),
    record: recordSchema,
    classifications: z.record(z.string(), z.string().max(100).nullable()),
    lineMatches: z.record(z.string(), z.string().max(150).nullable()),
    originalReviewed: z.boolean(),
    reason: z.string().trim().min(10).max(2000),
    tags: z.array(z.enum(CORPUS_TAGS as [string, ...string[]])).max(30),
    errorCauses: z
      .array(
        z.enum([
          "ocr",
          "table-layout",
          "metadata",
          "classification",
          "missing-source-field",
          "parser",
          "other",
        ]),
      )
      .max(10),
  })
  .strict();
const bad = (s: string, status = 400): never => {
  throw new HttpException(s, status);
};
export class Evaluation {
  constructor(private db: DataSource) {}
  async enroll(id: string, body: unknown) {
    z.string().uuid().parse(id);
    const b = z
      .object({
        realOriginal: z.boolean(),
        reason: z.string().trim().min(10).max(2000),
      })
      .strict()
      .parse(body);
    return this.db.transaction(async (m) => {
      const d = (
        await m.query("SELECT * FROM upload_document WHERE id=$1 FOR UPDATE", [
          id,
        ])
      )[0];
      if (!d) bad("Document not found", 404);
      if (
        b.realOriginal &&
        /SYNTHETIC|TEST ONLY|TEST DATA/i.test(
          d.provenance + " " + d.source_name,
        )
      )
        bad(
          "Known synthetic test documents cannot be marked as real originals",
        );
      if (["queued", "extracting", "cancelled"].includes(d.status))
        bad("Finish a processing attempt before enrolling this document", 409);
      if (!d.retain_evidence)
        bad(
          "Evidence and structured annotation retention permission is required",
        );
      const observation = (
        await m.query(
          "SELECT * FROM extraction_observation WHERE document_id=$1 ORDER BY observed_at DESC,id DESC LIMIT 1",
          [id],
        )
      )[0];
      const attempt = observation?.attempt_id
        ? { id: observation.attempt_id }
        : (
            await m.query(
              "SELECT id FROM document_attempt WHERE document_id=$1 AND status<>'running' ORDER BY started_at DESC,id DESC LIMIT 1",
              [id],
            )
          )[0];
      const draft = (
        await m.query(
          "SELECT record FROM extraction_draft WHERE document_id=$1",
          [id],
        )
      )[0];
      const record = draft?.record || {
        bidNumber: null,
        title: null,
        publishedAt: null,
        closesAt: null,
        buyer: { name: null, state: null, district: null },
        estimatedValue: null,
        items: [],
      };
      const predicted = observation?.classifications || {};
      const categories = Object.fromEntries(
        (record.items || []).map((i: any) => [
          i.key,
          predicted[i.key]?.productId ?? null,
        ]),
      );
      const matches = Object.fromEntries(
        (record.items || []).map((i: any) => [
          i.key,
          observation?.record.items.some((p: any) => p.key === i.key)
            ? i.key
            : null,
        ]),
      );
      await m.query(
        "INSERT INTO evaluation_case(document_id,observation_id,attempt_id,real_original,record,classifications,line_matches,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
        [
          id,
          observation?.id || null,
          attempt?.id || null,
          b.realOriginal,
          JSON.stringify(record),
          JSON.stringify(categories),
          JSON.stringify(matches),
          b.reason,
        ],
      );
      return (
        await m.query("SELECT * FROM evaluation_case WHERE document_id=$1", [
          id,
        ])
      )[0];
    });
  }
  async detail(id: string) {
    z.string().uuid().parse(id);
    const c = (
      await this.db.query(
        "SELECT e.*,o.record AS automatic,o.classifications AS automatic_classifications,o.evidence,o.parser_version FROM evaluation_case e LEFT JOIN extraction_observation o ON o.id=e.observation_id WHERE e.document_id=$1",
        [id],
      )
    )[0];
    return c
      ? {
          ...c,
          history: await this.db.query(
            "SELECT version,action,created_at,snapshot FROM evaluation_annotation WHERE document_id=$1 ORDER BY version DESC LIMIT 50",
            [id],
          ),
        }
      : null;
  }
  async annotate(id: string, action: "save" | "approve", body: unknown) {
    z.string().uuid().parse(id);
    const b = annotationSchema.parse(body);
    if (JSON.stringify(b).length > 250000) bad("Annotation exceeds 250 KB");
    return this.db.transaction(async (m) => {
      const c = (
        await m.query(
          "SELECT * FROM evaluation_case WHERE document_id=$1 FOR UPDATE",
          [id],
        )
      )[0];
      if (!c) bad("Enroll this document first", 404);
      if (c.version !== b.version)
        bad("Annotation changed; reload before saving", 409);
      const auto = c.observation_id
        ? (
            await m.query(
              "SELECT record FROM extraction_observation WHERE id=$1",
              [c.observation_id],
            )
          )[0].record
        : { items: [] };
      const keys = b.record.items.map((i) => i.key);
      if (new Set(keys).size !== keys.length)
        bad("Ground-truth item keys must be unique");
      if (action === "approve") {
        if (!b.originalReviewed)
          bad("Inspect every original page before approving ground truth");
        const used = new Set<string>();
        for (const i of b.record.items) {
          if (
            !Object.hasOwn(b.classifications, i.key) ||
            !Object.hasOwn(b.lineMatches, i.key)
          )
            bad(
              "Explicitly classify and match every ground-truth item; null means excluded or missing",
            );
          const p = b.classifications[i.key];
          if (
            p &&
            !(await m.query("SELECT 1 FROM product WHERE id=$1", [p])).length
          )
            bad("Unknown ground-truth product family");
          const match = b.lineMatches[i.key];
          if (match !== null) {
            if (
              !auto.items.some((a: any) => a.key === match) ||
              used.has(match)
            )
              bad(
                "Line matching must be one-to-one against the frozen parser observation",
              );
            used.add(match);
          }
        }
        if (
          Object.keys(b.lineMatches).some((k) => !keys.includes(k)) ||
          Object.keys(b.classifications).some((k) => !keys.includes(k))
        )
          bad("Remove annotations for deleted ground-truth items");
      }
      const version = c.version + 1;
      await m.query(
        "UPDATE evaluation_case SET status=$2,version=$3,record=$4,classifications=$5,line_matches=$6,original_reviewed=$7,tags=$8,error_causes=$9,reason=$10,updated_at=now(),approved_at=CASE WHEN $2='approved' THEN now() ELSE NULL END WHERE document_id=$1",
        [
          id,
          action === "approve" ? "approved" : "draft",
          version,
          JSON.stringify(b.record),
          JSON.stringify(b.classifications),
          JSON.stringify(b.lineMatches),
          b.originalReviewed,
          JSON.stringify(b.tags),
          JSON.stringify(b.errorCauses),
          b.reason,
        ],
      );
      await m.query(
        "INSERT INTO evaluation_annotation(id,document_id,version,action,snapshot) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          id,
          version,
          action,
          JSON.stringify({
            ...b,
            realOriginal: c.real_original,
            observationId: c.observation_id,
            attemptId: c.attempt_id,
          }),
        ],
      );
      return { version, status: action === "approve" ? "approved" : "draft" };
    });
  }
  async list(page = 1) {
    z.number().int().min(1).max(10000).parse(page);
    const data = await this.db.query(
      "SELECT e.document_id,e.version,e.status,e.real_original,e.tags,d.filename,d.status AS processing_status,count(*) OVER()::int AS total FROM evaluation_case e JOIN upload_document d ON d.id=e.document_id ORDER BY e.updated_at DESC,e.document_id LIMIT 30 OFFSET $1",
      [(page - 1) * 30],
    );
    return {
      data,
      total: data[0]?.total || 0,
      page,
      target: 50,
      tags: CORPUS_TAGS,
    };
  }
  async report(persist = false) {
    const rows = await this.db.query(
      "SELECT e.*,o.record AS automatic,o.classifications AS predicted,o.parser_version,o.page_methods,a.status AS processing_status,a.processing_ms,a.error FROM evaluation_case e LEFT JOIN extraction_observation o ON o.id=e.observation_id LEFT JOIN document_attempt a ON a.id=e.attempt_id WHERE e.status='approved' ORDER BY e.document_id",
    );
    const inputs: EvaluationInput[] = rows.map((r: any) => ({
      documentId: r.document_id,
      annotationVersion: r.version,
      observationId: r.observation_id,
      parserVersion: r.parser_version,
      realOriginal: r.real_original,
      automatic: r.automatic || { items: [] },
      truth: r.record,
      frozenCategoriesAvailable:
        r.observation_id === null || r.predicted !== null,
      predictedCategories: Object.fromEntries(
        Object.entries(r.predicted || {}).map(([k, c]: any) => [
          k,
          c.productId ?? null,
        ]),
      ),
      truthCategories: r.classifications,
      matches: r.line_matches,
      processingStatus: r.processing_status || "unrecorded",
      processingMs: r.processing_ms ?? null,
      methods: r.page_methods || [],
      error: r.error,
      errorCauses: r.error_causes,
      tags: r.tags,
    }));
    const report = {
      ...evaluateCorpus(inputs),
      generatedAt: new Date().toISOString(),
      corpusTags: CORPUS_TAGS.map((tag) => ({
        tag,
        approvedRealDocuments: inputs.filter(
          (c) => c.realOriginal && c.tags.includes(tag),
        ).length,
      })),
      enrolledDocuments: Number(
        (await this.db.query("SELECT count(*) AS n FROM evaluation_case"))[0].n,
      ),
    };
    if (persist) {
      const id = randomUUID();
      await this.db.query(
        "INSERT INTO evaluation_run(id,report) VALUES($1,$2)",
        [id, JSON.stringify(report)],
      );
      return { id, ...report };
    }
    return report;
  }
}
