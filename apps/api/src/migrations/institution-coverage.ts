import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
import { refreshNoticeClassifications } from "../collection/classification";
export { refreshNoticeClassifications } from "../collection/classification";

export class InstitutionCoverage1792411000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    for (const s of SOURCES.filter((s) => s.adapter)) {
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
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
