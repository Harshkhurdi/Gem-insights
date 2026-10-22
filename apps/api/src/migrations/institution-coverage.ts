import { MigrationInterface, QueryRunner } from "typeorm";
import { digest } from "../../../../packages/core/domain";
import { SOURCES } from "../collection/registry";
import { noticeClassification } from "../collection/parsers";

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

export async function refreshNoticeClassifications(
  q: Pick<QueryRunner, "query">,
) {
  // Classification is derived metadata. Refresh it without treating a rule
  // change as a new source observation or discarding an operator decision.
  const rules = await q.query("SELECT * FROM product");
  const rows = await q.query("SELECT id,source_id,raw FROM discovered_notice");
  const updates = rows.flatMap((n: any) => {
    const classification = noticeClassification(n.raw.title, rules);
    const raw = { ...n.raw, ...classification };
    if (JSON.stringify(raw) === JSON.stringify(n.raw)) return [];
    const source = SOURCES.find((s) => s.id === n.source_id);
    return [
      {
        id: n.id,
        raw,
        medical: classification.medical,
        products: classification.products,
        reason: classification.reason,
        hash: digest(
          source?.adapter === "cppp" && raw.bidNumber
            ? { ...raw, url: "" }
            : raw,
        ),
      },
    ];
  });
  if (updates.length)
    await q.query(
      `UPDATE discovered_notice n SET raw=x.raw,current_hash=x.hash,
    medical_candidate=x.medical,products=x.products,classification_reason=x.reason
    FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,raw jsonb,hash text,medical boolean,products jsonb,reason text)
    WHERE n.id=x.id`,
      [JSON.stringify(updates)],
    );
}
