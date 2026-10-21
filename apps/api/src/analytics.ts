import { DataSource } from "typeorm";
import { z } from "zod";
import { stateName, growth } from "../../../packages/core/domain";
import { Evaluation } from "./documents/evaluation";
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
export const filterSchema = z
  .object({
    evidence: z.enum(["all", "reviewed", "listing"]).default("all"),
    medical: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    state: z
      .string()
      .transform((s) => stateName(s)!)
      .optional(),
    district: z.string().max(200).optional(),
    product: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    buyer: z.string().uuid().optional(),
    buyerType: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
    status: z
      .enum(["open", "closed", "cancelled", "awarded", "unknown"])
      .optional(),
    q: z.string().max(200).optional(),
    basis: z.enum(["buyer", "delivery"]).default("buyer"),
    bucket: z
      .enum(["day", "week", "month", "quarter", "financial_year"])
      .default("month"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    sort: z
      .enum(["tenders", "units", "buyers", "value", "product"])
      .default("tenders"),
    products: z.string().max(600).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.to || f.from <= f.to,
    "Start date must precede end date",
  );
export type Filters = z.infer<typeof filterSchema>;
export class Analytics {
  constructor(private db: DataSource) {}
  scope(f: Filters) {
    const p: unknown[] = [];
    const add = (v: unknown) => {
      p.push(v);
      return "$" + p.length;
    };
    const w = ["t.status <> 'cancelled'"];
    if (f.evidence !== "all") w.push("t.evidence_level=" + add(f.evidence));
    if (f.medical != null) w.push("t.medical_candidate=" + add(f.medical));
    if (f.from) w.push("t.published_at >= " + add(f.from));
    if (f.to) w.push("t.published_at <= " + add(f.to));
    if (f.product) w.push("t.product_id=" + add(f.product));
    if (f.products) {
      const ids = f.products.split(",");
      if (ids.length > 5) throw new Error("Compare at most five products");
      w.push("t.product_id=ANY(" + add(ids) + "::text[])");
    }
    if (f.category) w.push("t.category_id IN (SELECT id FROM subtree)");
    if (f.buyer) w.push("t.organization_id=" + add(f.buyer));
    if (f.buyerType) w.push("t.buyer_type=" + add(f.buyerType));
    if (f.source) w.push(add(f.source) + "=ANY(t.source_ids)");
    if (f.status) {
      w[0] = "t.status=" + add(f.status);
    }
    if (f.q) {
      const s = add("%" + f.q + "%");
      w.push(
        `(t.title ILIKE ${s} OR t.bid_number ILIKE ${s} OR t.buyer_name ILIKE ${s} OR t.original_name ILIKE ${s})`,
      );
    }
    let allocation = "NULL::numeric";
    if (f.basis === "buyer") {
      if (f.state) w.push("t.buyer_state=" + add(f.state));
      if (f.district) w.push("t.buyer_district=" + add(f.district));
    } else {
      const dw = ["d.line_item_id=t.line_item_id", "d.confirmed"];
      if (f.state) dw.push("d.state=" + add(f.state));
      if (f.district) dw.push("d.district=" + add(f.district));
      if (f.state || f.district)
        w.push(
          "EXISTS(SELECT 1 FROM destination d WHERE " + dw.join(" AND ") + ")",
        );
      allocation =
        "(SELECT sum(d.quantity) FROM destination d WHERE " +
        dw.join(" AND ") +
        ")";
    }
    const cat = f.category ? add(f.category) : "NULL::text";
    return {
      p,
      cte: `WITH RECURSIVE subtree AS (SELECT id FROM category WHERE id=${cat} UNION ALL SELECT c.id FROM category c JOIN subtree s ON c.parent_id=s.id), facts AS (SELECT t.*,${allocation} AS allocated_quantity FROM insight_line t WHERE ${w.join(" AND ")})`,
    };
  }
  async overview(f: Filters) {
    const { cte, p } = this.scope(f);
    return (
      await this.db.query(
        cte +
          ` SELECT count(DISTINCT tender_id)::int AS tenders,count(DISTINCT tender_id) FILTER(WHERE medical_candidate)::int AS medical_tenders,count(DISTINCT product_id)::int AS products,count(DISTINCT organization_id) FILTER(WHERE medical_candidate)::int AS buyers,(SELECT sum(v) FROM (SELECT DISTINCT tender_id,tender_value AS v FROM facts) x) AS known_value,(SELECT count(*)::int FROM (SELECT DISTINCT tender_id FROM facts WHERE tender_value IS NOT NULL) x) AS valued_tenders,count(DISTINCT tender_id) FILTER(WHERE published_at >= (now() AT TIME ZONE 'Asia/Kolkata')::date-6)::int AS new_week,count(DISTINCT tender_id) FILTER(WHERE published_at IS NULL)::int AS undated_tenders,count(DISTINCT tender_id) FILTER(WHERE evidence_level='listing')::int AS listing_notices,count(DISTINCT tender_id) FILTER(WHERE evidence_level='reviewed')::int AS reviewed_tenders FROM facts`,
        p,
      )
    )[0];
  }
  async products(f: Filters) {
    const { cte, p } = this.scope(f);
    const sort = {
      tenders: "tenders DESC",
      units: "rank_units DESC NULLS LAST",
      buyers: "buyers DESC",
      value: "known_value DESC NULLS LAST",
      product: "product_name ASC",
    }[f.sort];
    return this.db.query(
      cte +
        `, by_unit AS (SELECT product_id,unit,sum(CASE WHEN $${p.length + 1}::boolean THEN allocated_quantity ELSE quantity END) AS qty,count(*) FILTER(WHERE quantity IS NULL)::int AS unknown_lines FROM facts WHERE product_id IS NOT NULL GROUP BY product_id,unit), quantities AS (SELECT product_id,jsonb_object_agg(unit,qty) AS quantities,sum(qty) FILTER(WHERE unit='units') AS rank_units FROM by_unit GROUP BY product_id) SELECT f.product_id,f.product_name,c.name AS category,count(DISTINCT f.tender_id)::int AS tenders,count(*)::int AS lines,count(DISTINCT organization_id)::int AS buyers,count(DISTINCT buyer_state)::int AS buyer_states,count(*) FILTER(WHERE quantity IS NULL)::int AS missing_quantity_lines,count(*) FILTER(WHERE evidence_level='listing')::int AS listing_signals,sum(estimated_value) AS known_value,count(estimated_value)::int AS valued_lines,q.quantities,q.rank_units,(SELECT buyer_state FROM facts t2 WHERE t2.product_id=f.product_id AND buyer_state IS NOT NULL GROUP BY buyer_state ORDER BY count(DISTINCT tender_id) DESC,buyer_state LIMIT 1) AS top_buyer_state FROM facts f JOIN category c ON c.id=f.category_id LEFT JOIN quantities q ON q.product_id=f.product_id WHERE f.product_id IS NOT NULL GROUP BY f.product_id,f.product_name,c.name,q.quantities,q.rank_units ORDER BY ${sort},f.product_id`,
      [...p, f.basis === "delivery" && !!(f.state || f.district)],
    );
  }
  async states(f: Filters) {
    const { cte, p } = this.scope(f);
    if (f.basis === "buyer")
      return this.db.query(
        cte +
          ` SELECT buyer_state AS state,count(DISTINCT tender_id)::int AS tenders,count(DISTINCT organization_id)::int AS buyers,(SELECT jsonb_object_agg(unit,qty) FROM (SELECT unit,sum(quantity) qty FROM facts z WHERE z.buyer_state IS NOT DISTINCT FROM f.buyer_state AND product_id IS NOT NULL GROUP BY unit) u) AS quantities FROM facts f WHERE medical_candidate GROUP BY buyer_state ORDER BY tenders DESC`,
        p,
      );
    return this.db.query(
      cte +
        `, located AS (SELECT f.*,d.state,d.district,d.quantity AS destination_quantity FROM facts f JOIN destination d ON d.line_item_id=f.line_item_id AND d.confirmed WHERE f.medical_candidate ${f.state ? "AND d.state=$" + p.push(f.state) : ""} ${f.district ? "AND d.district=$" + p.push(f.district) : ""}) SELECT state,count(DISTINCT tender_id)::int AS tenders,count(DISTINCT organization_id)::int AS buyers,(SELECT jsonb_object_agg(unit,qty) FROM (SELECT unit,sum(destination_quantity) AS qty FROM located z WHERE z.state=f.state GROUP BY unit) u) AS quantities FROM located f GROUP BY state ORDER BY tenders DESC`,
      p,
    );
  }
  async districts(f: Filters) {
    const { cte, p } = this.scope(f);
    if (f.basis === "buyer")
      return this.db.query(
        cte +
          ` SELECT buyer_state AS state,buyer_district AS district,count(DISTINCT tender_id)::int AS tenders FROM facts WHERE medical_candidate GROUP BY buyer_state,buyer_district ORDER BY tenders DESC`,
        p,
      );
    return this.db.query(
      cte +
        ` SELECT d.state,d.district,count(DISTINCT f.tender_id)::int AS tenders FROM facts f JOIN destination d ON d.line_item_id=f.line_item_id AND d.confirmed WHERE f.medical_candidate ${f.state ? "AND d.state=$" + p.push(f.state) : ""} ${f.district ? "AND d.district=$" + p.push(f.district) : ""} GROUP BY d.state,d.district ORDER BY tenders DESC`,
      p,
    );
  }
  async buyers(f: Filters) {
    const { cte, p } = this.scope(f);
    return this.db.query(
      cte +
        ` SELECT organization_id AS id,buyer_name AS name,buyer_state AS state,count(DISTINCT tender_id)::int AS tenders,count(DISTINCT product_id)::int AS products,(SELECT sum(v) FROM (SELECT DISTINCT tender_id,tender_value AS v FROM facts x WHERE x.organization_id=f.organization_id) d) AS known_value FROM facts f WHERE medical_candidate AND organization_id IS NOT NULL GROUP BY organization_id,buyer_name,buyer_state ORDER BY tenders DESC,buyer_name`,
      p,
    );
  }
  async categories(f: Filters) {
    const { cte, p } = this.scope(f);
    return this.db.query(
      cte +
        ` SELECT c.id,c.name,count(DISTINCT f.tender_id)::int AS tenders,count(DISTINCT product_id)::int AS products,count(DISTINCT organization_id)::int AS buyers FROM category c LEFT JOIN facts f ON f.category_id=c.id WHERE c.parent_id='medical' GROUP BY c.id,c.name ORDER BY tenders DESC,c.name`,
      p,
    );
  }
  async trends(f: Filters) {
    const { cte, p } = this.scope(f);
    const b =
      f.bucket === "financial_year"
        ? "(extract(year FROM published_at - interval '3 months'))::text || '-' || (extract(year FROM published_at - interval '3 months')+1)::text"
        : `to_char(date_trunc('${f.bucket}',published_at),'YYYY-MM-DD')`;
    return this.db.query(
      cte +
        `, buckets AS (SELECT facts.*,${b} AS period,CASE WHEN $${p.length + 1}::boolean THEN allocated_quantity ELSE quantity END AS measure_quantity FROM facts WHERE medical_candidate AND published_at IS NOT NULL), counts AS (SELECT period,product_id,product_name,count(DISTINCT tender_id)::int AS tenders FROM buckets GROUP BY period,product_id,product_name), unit_totals AS (SELECT period,product_id,unit,sum(measure_quantity) AS qty FROM buckets GROUP BY period,product_id,unit), quantities AS (SELECT period,product_id,jsonb_object_agg(unit,qty) AS quantities FROM unit_totals GROUP BY period,product_id) SELECT c.*,q.quantities FROM counts c JOIN quantities q ON c.period=q.period AND c.product_id IS NOT DISTINCT FROM q.product_id ORDER BY c.period,c.product_name`,
      [...p, f.basis === "delivery" && !!(f.state || f.district)],
    );
  }

  async growth(f: Filters) {
    const end = f.to || new Date().toISOString().slice(0, 10);
    const start =
      f.from ||
      new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    if (days > 3660) throw new Error("Comparison range too large");
    const prevEnd = new Date(Date.parse(start) - 86400000)
        .toISOString()
        .slice(0, 10),
      prevStart = new Date(Date.parse(start) - days * 86400000)
        .toISOString()
        .slice(0, 10);
    const cur = await this.products({ ...f, from: start, to: end }),
      prev = await this.products({ ...f, from: prevStart, to: prevEnd });
    return {
      periods: { current: [start, end], previous: [prevStart, prevEnd] },
      coverageComparable: false,
      products: cur.map((r: any) => ({
        ...r,
        previous_tenders:
          prev.find((x: any) => x.product_id === r.product_id)?.tenders || 0,
        growth: growth(
          r.tenders,
          prev.find((x: any) => x.product_id === r.product_id)?.tenders || 0,
        ),
      })),
    };
  }
  async tenders(f: Filters) {
    const { cte, p } = this.scope(f);
    const rows = await this.db.query(
      cte +
        ` SELECT tender_id AS id,bid_number,title,source_url,published_at,closes_at,status,buyer_name,buyer_state,tender_value,jsonb_agg(jsonb_build_object('id',id,'name',original_name,'product',product_name,'quantity',quantity,'unit',unit,'evidence',evidence,'confidence',confidence,'needs_review',needs_review)) AS items,evidence_level,source_portal,closing_date,max(source_observations) AS source_observations,count(*) OVER()::int AS total FROM facts GROUP BY tender_id,bid_number,title,source_url,published_at,closes_at,status,buyer_name,buyer_state,tender_value,evidence_level,source_portal,closing_date ORDER BY published_at DESC NULLS LAST,bid_number LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, f.limit, (f.page - 1) * f.limit],
    );
    return {
      data: rows,
      total: rows[0]?.total || 0,
      page: f.page,
      limit: f.limit,
    };
  }
  async coverage() {
    const [sources, runs, quality, jobs, total, observed] = await Promise.all([
      this.db.query("SELECT * FROM source ORDER BY id"),
      this.db.query(
        "SELECT * FROM collection_run ORDER BY started_at DESC LIMIT 30",
      ),
      this.db.query(
        `SELECT count(*)::int AS lines,count(*) FILTER(WHERE needs_review)::int AS needs_review,count(*) FILTER(WHERE quantity IS NULL)::int AS unknown_quantity,count(*) FILTER(WHERE product_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM destination d WHERE d.line_item_id=l.id AND d.confirmed))::int AS missing_delivery FROM line_item l`,
      ),
      this.db.query(
        "SELECT id,kind,status,attempts,last_error,created_at,finished_at FROM job ORDER BY created_at DESC LIMIT 30",
      ),
      this.db.query(
        "SELECT count(*)::int AS tenders,min(published_at) AS earliest,max(published_at) AS latest,max(last_checked) AS checked FROM tender",
      ),
      this.db.query(
        "SELECT count(*)::int AS records,count(*) FILTER(WHERE evidence_level='listing')::int AS listing_notices,count(*) FILTER(WHERE evidence_level='reviewed')::int AS reviewed_tenders,max(last_checked) AS checked FROM insight_record WHERE status<>'cancelled'",
      ),
    ]);
    return {
      coverage: "partial",
      nationalCompleteness: null,
      liveGeM: false,
      sources,
      runs,
      quality: quality[0],
      jobs,
      total: { ...total[0], checked: observed[0].checked || total[0].checked },
      observed: observed[0],
      dataQuality: await this.dataQuality(),
      warning:
        "Observed dataset only. No verified all-India denominator. Closed bids are not confirmed purchases.",
    };
  }
  async dataQuality() {
    const [t, l, docs, states, products, buyers, sources, months, report] =
      await Promise.all([
        this.db.query(
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE o.state IS NOT NULL)::int AS buyer_states,count(*) FILTER(WHERE t.published_at IS NOT NULL)::int AS publication_dates,count(*) FILTER(WHERE t.estimated_value IS NOT NULL)::int AS explicit_values FROM tender t JOIN organization o ON o.id=t.organization_id",
        ),
        this.db.query(
          "SELECT count(*)::int AS total,count(*) FILTER(WHERE quantity IS NOT NULL)::int AS known_quantities,count(*) FILTER(WHERE needs_review)::int AS unresolved,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM destination d WHERE d.line_item_id=l.id AND d.confirmed))::int AS confirmed_delivery FROM line_item l",
        ),
        this.db.query(
          "SELECT count(*)::int AS uploaded,count(*) FILTER(WHERE extracted_at IS NOT NULL)::int AS extracted,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM extraction_review r WHERE r.document_id=d.id))::int AS reviewed,count(*) FILTER(WHERE status='approved')::int AS approved,count(*) FILTER(WHERE status='failed')::int AS failures,count(*) FILTER(WHERE status='needs_ocr')::int AS needs_ocr,count(*) FILTER(WHERE status IN ('queued','extracting'))::int AS queued,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM evaluation_case e WHERE e.document_id=d.id AND e.status='approved'))::int AS annotated FROM upload_document d",
        ),
        this.db.query(
          "SELECT o.state,count(DISTINCT t.id)::int AS tenders FROM tender t JOIN organization o ON o.id=t.organization_id GROUP BY o.state ORDER BY tenders DESC",
        ),
        this.db.query(
          "SELECT p.id,p.name,count(DISTINCT l.tender_id)::int AS tenders,count(*)::int AS lines FROM line_item l LEFT JOIN product p ON p.id=l.product_id GROUP BY p.id,p.name ORDER BY tenders DESC",
        ),
        this.db.query(
          "SELECT o.id,o.name,count(*)::int AS tenders FROM tender t JOIN organization o ON o.id=t.organization_id GROUP BY o.id ORDER BY tenders DESC LIMIT 100",
        ),
        this.db.query(
          "SELECT s.id,s.name,count(t.id)::int AS tenders FROM source s LEFT JOIN tender t ON t.source_id=s.id GROUP BY s.id ORDER BY s.id",
        ),
        this.db.query(
          "SELECT to_char(published_at,'YYYY-MM') AS month,count(*)::int AS tenders FROM tender GROUP BY to_char(published_at,'YYYY-MM') ORDER BY month DESC NULLS LAST LIMIT 120",
        ),
        new Evaluation(this.db).report(),
      ]);
    const percent = (known: number, total: number) => ({
      known,
      total,
      percent: total ? (100 * known) / total : null,
    });
    const { documents: details, frequentFailures, ...evaluation } = report;
    return {
      portal: "multiple",
      nationalPublishedTenders: null,
      storedVerifiedTenders: t[0].total,
      documents: docs[0],
      unresolvedClassifications: l[0].unresolved,
      percentages: {
        knownQuantities: percent(l[0].known_quantities, l[0].total),
        sourceRecordedBuyerStates: percent(t[0].buyer_states, t[0].total),
        confirmedDeliveryLocations: percent(
          l[0].confirmed_delivery,
          l[0].total,
        ),
        publicationDates: percent(t[0].publication_dates, t[0].total),
        explicitTenderValues: percent(t[0].explicit_values, t[0].total),
      },
      breakdowns: { states, products, buyers, sources, months },
      evaluation,
      warning:
        "Stored source-reviewed/imported official tender records, including cancelled historical snapshots; not the number published nationally. Buyer states are source-recorded, not independently geocoded. Product/state groups overlap. Buyer breakdown is the top 100; publication periods show the latest 120 observed months. Missing dates/states remain separate. Corpus annotations never contribute tender demand.",
    };
  }
}
