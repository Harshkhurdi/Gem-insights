import { MigrationInterface, QueryRunner } from "typeorm";

export class MainInsights1792412000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
CREATE VIEW insight_record AS
WITH reviewed AS (
  SELECT t.*,o.name AS buyer_name,o.state AS buyer_state,o.district AS buyer_district,o.type AS buyer_type,
    CASE WHEN t.source_portal='gem' THEN 'gem:'||upper(regexp_replace(t.bid_number,'\\s','','g'))
      WHEN t.bid_number ~ '^\\d{4}_[A-Za-z0-9]+_\\d+(_\\d+)?$' THEN 'cppp:'||t.bid_number
      ELSE 'reviewed:'||t.source_portal||':'||t.bid_number END AS identity
  FROM tender t JOIN organization o ON o.id=t.organization_id
), listing_base AS (
  SELECT n.*,coalesce(linked.identity,
    CASE WHEN n.source_portal='gem' AND n.bid_number IS NOT NULL THEN 'gem:'||upper(regexp_replace(n.bid_number,'\\s','','g'))
      WHEN n.bid_number ~ '^\\d{4}_[A-Za-z0-9]+_\\d+(_\\d+)?$' THEN 'cppp:'||n.bid_number
      WHEN n.source_url ~* '\\.(pdf|docx?|xlsx?|zip)([?#]|$)' THEN 'document:'||split_part(n.source_url,'#',1)
      ELSE 'listing:'||n.source_id||':'||n.external_key END) AS identity
  FROM discovered_notice n LEFT JOIN LATERAL (
    SELECT r.identity FROM reviewed r WHERE r.id=n.tender_id OR
      (n.bid_number IS NOT NULL AND r.source_portal=n.source_portal AND r.bid_number=n.bid_number AND r.source_url=n.source_url)
    ORDER BY (r.id=n.tender_id) DESC NULLS LAST,r.last_checked DESC,r.id LIMIT 1
  ) linked ON true WHERE n.review_status<>'dismissed'
), origins AS (
  SELECT identity,array_agg(DISTINCT source_id) FILTER(WHERE source_id IS NOT NULL) AS source_ids FROM (
    SELECT identity,source_id FROM reviewed UNION ALL SELECT identity,source_id FROM listing_base
  ) x GROUP BY identity
), listing_groups AS (
  SELECT identity,min(published_at) AS published_at,min(first_seen) AS first_seen,max(last_seen) AS last_checked,
    bool_or(medical_candidate) AS medical_candidate,count(*)::int AS source_observations,array_agg(id) AS observation_ids,
    CASE WHEN count(DISTINCT buyer_name)=1 THEN min(buyer_name) END AS buyer_name,
    CASE WHEN count(DISTINCT buyer_state)=1 THEN min(buyer_state) END AS buyer_state
  FROM listing_base GROUP BY identity
), listing_products AS (
  SELECT identity,jsonb_agg(DISTINCT p.product_id) AS products FROM listing_base CROSS JOIN LATERAL jsonb_array_elements_text(products) AS p(product_id) GROUP BY identity
), listing_documents AS (
  SELECT identity,jsonb_agg(DISTINCT d.url) AS documents FROM listing_base CROSS JOIN LATERAL jsonb_array_elements_text(documents) AS d(url) GROUP BY identity
), latest_listing AS (
  SELECT DISTINCT ON(identity) * FROM listing_base ORDER BY identity,last_seen DESC,id
), latest_reviewed AS (
  SELECT DISTINCT ON(identity) * FROM reviewed ORDER BY identity,last_checked DESC,id
)
SELECT r.id,r.identity,r.bid_number,r.title,r.source_url,r.source_id,o.source_ids,r.source_portal,
  r.organization_id,r.buyer_name,r.buyer_state,r.buyer_district,r.buyer_type,r.published_at,r.closes_at,NULL::date AS closing_date,
  r.status,r.estimated_value,'reviewed'::text AS evidence_level,
  EXISTS(SELECT 1 FROM line_item l WHERE l.tender_id=r.id AND l.product_id IS NOT NULL) AS medical_candidate,
  '[]'::jsonb AS products,'[]'::jsonb AS documents,r.first_seen,r.last_checked,r.raw,
  coalesce(g.source_observations,0) AS source_observations,coalesce(g.observation_ids,'{}'::uuid[]) AS observation_ids
FROM latest_reviewed r JOIN origins o USING(identity) LEFT JOIN listing_groups g USING(identity)
UNION ALL
SELECT n.id,n.identity,n.bid_number,n.title,n.source_url,n.source_id,o.source_ids,n.source_portal,
  CASE WHEN g.buyer_name IS NULL THEN NULL ELSE coalesce(known.id,overlay(overlay(md5('listing-buyer:'||lower(regexp_replace(trim(g.buyer_name),'\\s+',' ','g'))||':'||coalesce(g.buyer_state,'')) placing '5' from 13 for 1) placing '8' from 17 for 1)::uuid) END,
  g.buyer_name,g.buyer_state,NULL::text,NULL::text,g.published_at,NULL::timestamptz,n.closing_date,
  'unknown',NULL::numeric,'listing',g.medical_candidate,coalesce(p.products,'[]'),coalesce(d.documents,'[]'),g.first_seen,g.last_checked,n.raw,g.source_observations,g.observation_ids
FROM latest_listing n JOIN listing_groups g USING(identity) JOIN origins o USING(identity)
LEFT JOIN listing_products p USING(identity) LEFT JOIN listing_documents d USING(identity)
LEFT JOIN LATERAL (SELECT id FROM organization WHERE lower(regexp_replace(trim(name),'\\s+',' ','g'))=lower(regexp_replace(trim(g.buyer_name),'\\s+',' ','g')) AND state IS NOT DISTINCT FROM g.buyer_state ORDER BY id LIMIT 1) known ON true
WHERE NOT EXISTS(SELECT 1 FROM reviewed r WHERE r.identity=n.identity);

CREATE VIEW insight_line AS
SELECT coalesce(l.id,md5(r.id::text||':'||coalesce(candidate.id,'unclassified'))::uuid) AS id,r.id AS tender_id,
  coalesce(l.source_key,'listing-title') AS source_key,coalesce(l.original_name,r.title) AS original_name,
  coalesce(l.product_id,candidate.id) AS product_id,l.quantity,coalesce(l.unit,'unknown') AS unit,l.estimated_value,
  coalesce(l.evidence,'Public listing title: '||r.title||' — '||r.source_url) AS evidence,l.confidence,
  coalesce(l.classification_reason,'Title-based signal; item identity, quantity and value have not been extracted') AS classification_reason,
  coalesce(l.needs_review,true) AS needs_review,l.id AS line_item_id,
  CASE WHEN r.evidence_level='listing' THEN r.medical_candidate ELSE l.product_id IS NOT NULL END AS medical_candidate,
  coalesce(actual.name,candidate.name,CASE WHEN r.evidence_level='listing' AND r.medical_candidate THEN 'Other clinical procurement' END) AS product_name,
  coalesce(actual.category_id,candidate.category_id) AS category_id,
  r.bid_number,r.title,r.source_url,r.source_id,r.source_ids,r.source_portal,r.published_at,r.closes_at,r.closing_date,r.status,
  r.organization_id,r.estimated_value AS tender_value,r.buyer_name,r.buyer_state,r.buyer_district,r.buyer_type,r.evidence_level,r.source_observations
FROM insight_record r LEFT JOIN line_item l ON r.evidence_level='reviewed' AND l.tender_id=r.id
LEFT JOIN product actual ON actual.id=l.product_id
LEFT JOIN LATERAL (SELECT p.* FROM product p WHERE r.evidence_level='listing' AND r.products ? p.id) candidate ON true
WHERE r.evidence_level='listing' OR l.id IS NOT NULL;
    `);
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
