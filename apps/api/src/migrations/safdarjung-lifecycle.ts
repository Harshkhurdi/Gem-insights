import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
export class SafdarjungLifecycle1792427000000 implements MigrationInterface {
  // Safdarjung's documented blocker (mixed tenders, awards, auctions and
  // procured-equipment reports) is resolved by lifecycle separation at
  // collection; the source becomes an automated profile. Existing pauses,
  // checkpoints and reviews are preserved.
  async up(q: Pick<QueryRunner, "query">) {
    for (const s of SOURCES.filter((s) => s.id === "safdarjung")) {
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
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
