import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
import { refreshNoticeClassifications } from "./institution-coverage";
import { mainInsightViews } from "./main-insights";

export const aiimsListingIdentity = `WHEN n.source_id IN ('aiims-delhi','aiims-delhi-archive-open','aiims-delhi-archive-proprietary','aiims-delhi-archive-limited')
      AND n.source_url ~ '^https://www\\.aiims\\.edu/index\\.php/en/tenders(/archive-tender/(global-open-tender|proprietary-tender|short-rate-limited-enquiry))?\\?'
      AND substring(n.source_url from '[?&]id=([0-9]+)') IS NOT NULL
      THEN 'aiims-delhi:article:'||substring(n.source_url from '[?&]id=([0-9]+)')`;

export class AiimsCoverage1792413000000 implements MigrationInterface {
  async up(q: Pick<QueryRunner, "query">) {
    for (const s of SOURCES.filter((s) =>
      ["aiims-delhi", "bathinda"].includes(s.adapter || ""),
    )) {
      await q.query(
        `INSERT INTO source(id,name,mode,coverage,access_notes,listing_url,portal,states,adapter,enabled)
        VALUES($1,$2,'public-listing','partial',$3,$4,$5,$6,$7,true)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,mode=EXCLUDED.mode,access_notes=EXCLUDED.access_notes,listing_url=EXCLUDED.listing_url,portal=EXCLUDED.portal,states=EXCLUDED.states,adapter=EXCLUDED.adapter,
        enabled=CASE WHEN source.adapter IS NULL THEN true ELSE source.enabled END,
        checkpoint=CASE WHEN source.listing_url IS DISTINCT FROM EXCLUDED.listing_url THEN NULL ELSE source.checkpoint END`,
        [
          s.id,
          s.name,
          s.scope,
          s.url,
          s.portal,
          JSON.stringify(s.states),
          s.adapter,
        ],
      );
    }
    await refreshNoticeClassifications(q);
    // A Delhi article can move from the current list to one of three archives.
    // Its original URL must stay usable: expired articles can return 404 through
    // the current-list route. Group by the explicit site article ID instead of
    // rewriting those links or inventing an official tender reference.
    await q.query("DROP VIEW insight_line; DROP VIEW insight_record");
    await q.query(mainInsightViews(aiimsListingIdentity));
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
