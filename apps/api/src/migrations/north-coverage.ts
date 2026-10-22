import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";

import { refreshNoticeClassifications } from "../collection/classification";
import { mainInsightViews } from "./main-insights";
import { aiimsListingIdentity } from "./aiims-coverage";
export class NorthCoverage1792417000000 implements MigrationInterface {
  async up(q: Pick<QueryRunner, "query">) {
    for (const s of SOURCES.filter(
      (s) =>
        [
          "jammu",
          "jkmscl",
          "nhm-ladakh",
          "kgmu",
          "kcgmc",
          "s3waas",
          "skims",
        ].includes(s.adapter || "") ||
        [
          "hmscl",
          "uhsr",
          "aiims-jodhpur",
          "bfuhs",
          "sgpgims",
          "rmlh",
          "igmc-shimla",
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
    await refreshNoticeClassifications(q);
    // Jammu demonstrably reuses PDF paths for unrelated titles. Exact title +
    // document pairs can group across its profiles; conflicting titles cannot.
    await q.query("DROP VIEW insight_line; DROP VIEW insight_record");
    await q.query(
      mainInsightViews(
        aiimsListingIdentity +
          `
      WHEN n.source_id IN ('aiims-jammu','aiims-jammu-open','aiims-jammu-quotations')
        AND n.source_url ~* '[.](pdf|docx?|xlsx?|zip)([?#]|$)'
      THEN 'jammu-document:'||split_part(n.source_url,'#',1)||':'||md5(n.title)
      WHEN n.source_id='jkmscl' AND n.source_url ~* '[.](pdf|docx?|xlsx?|zip)([?#]|$)'
      THEN 'jkmscl-document:'||coalesce(n.bid_number,'')||':'||split_part(n.source_url,'#',1)||':'||md5(n.title)
    `,
      ),
    );
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
