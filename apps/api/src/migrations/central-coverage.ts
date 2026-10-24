import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
import { refreshNoticeClassifications } from "../collection/classification";
export class CentralCoverage1792420000000 implements MigrationInterface {
  // Central India rollout begins with AIIMS Bhopal, the region's largest
  // public medical procurement publisher found reachable on 23 October 2026.
  // Existing pauses, checkpoints and review decisions are preserved.
  async up(q: Pick<QueryRunner, "query">) {
    for (const s of SOURCES.filter((s) => ["aiims-bhopal"].includes(s.id))) {
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
    // Cystoscopy equipment appears in real AIIMS Bhopal listings but was not
    // previously recognized. Seed the family additively; local name/alias
    // customizations survive.
    await q.query(
      `INSERT INTO product(id,name,category_id,aliases) VALUES('cystoscopes','Cystoscopes','surgical-specialties','["cystoscope","cystoscopy telescope","cystoscopy system"]'::jsonb)
      ON CONFLICT(id) DO UPDATE SET aliases=product.aliases ||
        coalesce((SELECT jsonb_agg(a.value) FROM jsonb_array_elements('["cystoscope","cystoscopy telescope","cystoscopy system"]'::jsonb) a(value)
          WHERE NOT product.aliases @> jsonb_build_array(a.value)), '[]'::jsonb)`,
    );
    await refreshNoticeClassifications(q);
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
