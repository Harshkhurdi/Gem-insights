import { QueryRunner } from "typeorm";
import { digest } from "../../../../packages/core/domain";
import { SOURCES } from "./registry";
import { noticeClassification } from "./parsers";

export async function refreshNoticeClassifications(
  q: Pick<QueryRunner, "query">,
) {
  // Classification is derived metadata. Refresh it without treating a rule
  // change as a new source observation or discarding an operator decision.
  const rules = await q.query("SELECT * FROM product");
  const rows = await q.query(
    "SELECT id,source_id,raw,current_hash FROM discovered_notice",
  );
  const updates = rows.flatMap((n: any) => {
    const source = SOURCES.find((s) => s.id === n.source_id);
    const classification = noticeClassification(n.raw.title, rules, source);
    const raw = { ...n.raw, ...classification };
    if (JSON.stringify(raw) === JSON.stringify(n.raw)) return [];
    return [
      {
        id: n.id,
        expectedHash: n.current_hash,
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
    FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,raw jsonb,hash text,medical boolean,products jsonb,reason text,"expectedHash" text)
    WHERE n.id=x.id AND n.current_hash=x."expectedHash"`,
      [JSON.stringify(updates)],
    );
}
