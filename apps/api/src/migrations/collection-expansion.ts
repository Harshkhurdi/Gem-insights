import { MigrationInterface, QueryRunner } from "typeorm";
import { digest } from "../../../../packages/core/domain";
import { noticeKey } from "../collection/parsers";
import { SOURCES } from "../collection/registry";
export class CollectionExpansion1792410000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      "INSERT INTO product(id,name,category_id,aliases) VALUES('cbct','Cone beam CT systems','diagnostic-imaging','[\"cone beam computed tomography\",\"cone beam ct\",\"cbct\"]') ON CONFLICT DO NOTHING",
    );
    for (const s of SOURCES.filter((s) => s.adapter)) {
      await q.query(
        `INSERT INTO source(id,name,mode,coverage,access_notes,listing_url,portal,states,adapter,enabled)
      VALUES($1,$2,'public-listing','partial',$3,$4,$5,$6,$7,true)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,mode=EXCLUDED.mode,access_notes=EXCLUDED.access_notes,listing_url=EXCLUDED.listing_url,portal=EXCLUDED.portal,states=EXCLUDED.states,adapter=EXCLUDED.adapter,enabled=CASE WHEN source.adapter IS NULL THEN true ELSE source.enabled END,checkpoint=CASE WHEN source.listing_url IS DISTINCT FROM EXCLUDED.listing_url THEN NULL ELSE source.checkpoint END`,
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
    for (const source of SOURCES.filter((s) => s.adapter)) {
      const rows = await q.query(
        "SELECT id,raw FROM discovered_notice WHERE source_id=$1",
        [source.id],
      );
      for (const n of rows) {
        const raw = {
          ...n.raw,
          key: noticeKey(source, n.raw.bidNumber, n.raw.url),
        };
        const hash = digest(
          source.adapter === "cppp" && raw.bidNumber
            ? { ...raw, url: "" }
            : raw,
        );
        await q.query(
          "UPDATE discovered_notice SET external_key=$2,raw=$3,current_hash=$4 WHERE id=$1",
          [n.id, raw.key, JSON.stringify(raw), hash],
        );
      }
    }
    await q.query(`CREATE TABLE notice_document_link(
      notice_id uuid NOT NULL REFERENCES discovered_notice(id) ON DELETE CASCADE,
      source_url text NOT NULL,document_id uuid NOT NULL REFERENCES upload_document(id),
      notice_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(notice_id,source_url)
    );
    CREATE UNIQUE INDEX one_notice_pdf_job ON job((payload->>'noticeId'),(payload->>'documentIndex')) WHERE kind='notice-pdf' AND status IN ('pending','running');`);
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
