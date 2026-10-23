import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
import { refreshNoticeClassifications } from "../collection/classification";
import { mainInsightViews } from "./main-insights";
import { northListingIdentity } from "./north-coverage";
export const northPublicListingIdentity =
  northListingIdentity +
  `
      WHEN n.source_id IN ('aiims-raebareli','aiims-raebareli-archive','aiims-raebareli-quotations','aiims-raebareli-quotations-archive','aiims-raebareli-pac')
        AND n.source_url ~ '^https://aiimsrbl[.]edu[.]in/(tender|quotation|pac)-file-download/[0-9]+$'
      THEN 'raebareli-download:'||n.source_url
      WHEN n.source_id IN ('aiims-gorakhpur','aiims-gorakhpur-quotations','aiims-gorakhpur-quotations-archive','aiims-gorakhpur-pac')
        AND n.source_url ~* '[.](pdf|docx?|xlsx?|zip)([?#]|$)'
      THEN 'gorakhpur-document:'||split_part(n.source_url,'#',1)||':'||md5(n.title)
    `;
export class NorthPublicSources1792418000000 implements MigrationInterface {
  async up(q: Pick<QueryRunner, "query">) {
    for (const s of SOURCES.filter(
      (s) =>
        ["raebareli", "gorakhpur"].includes(s.adapter || "") ||
        [
          "uttarakhand-health",
          "uttarakhand-health-archive",
          "phsc",
          "safdarjung",
          "aiims-gorakhpur-archive",
        ].includes(s.id),
    )) {
      await q.query(
        `INSERT INTO source(id,name,mode,coverage,access_notes,listing_url,portal,states,adapter,enabled)
        VALUES($1,$2,$8,'partial',$3,$4,$5,$6,$7,$9)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,mode=EXCLUDED.mode,access_notes=EXCLUDED.access_notes,listing_url=EXCLUDED.listing_url,portal=EXCLUDED.portal,states=EXCLUDED.states,adapter=EXCLUDED.adapter,
        enabled=CASE WHEN EXCLUDED.adapter IS NULL THEN false WHEN source.adapter IS NULL THEN true ELSE source.enabled END,
        checkpoint=CASE WHEN source.listing_url IS DISTINCT FROM EXCLUDED.listing_url THEN NULL ELSE source.checkpoint END`,
        [
          s.id,
          s.name,
          s.scope,
          s.url,
          s.portal,
          JSON.stringify(s.states),
          s.adapter,
          s.adapter ? "public-listing" : "assisted",
          !!s.adapter,
        ],
      );
    }
    await q.query(`UPDATE product SET aliases=aliases || '["usg machine"]'::jsonb
      WHERE id='ultrasound' AND NOT aliases @> '["usg machine"]'::jsonb`);
    await refreshNoticeClassifications(q);
    await q.query("DROP VIEW insight_line; DROP VIEW insight_record");
    await q.query(mainInsightViews(northPublicListingIdentity));
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
