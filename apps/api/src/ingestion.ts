import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import {
  classify,
  digest,
  Rule,
  stateName,
  validateTender,
} from "../../../packages/core/domain";
export class Ingestion {
  constructor(private db: DataSource) {}
  async import(records: unknown[], provenance: string, source = "import") {
    if (!Array.isArray(records) || records.length < 1 || records.length > 1000)
      throw new Error("Import between 1 and 1000 complete tender records");
    const runId = randomUUID();
    await this.db.query(
      "INSERT INTO collection_run(id,source_id,status,discovered,provenance) VALUES($1,$2,'running',$3,$4)",
      [runId, source, records.length, provenance],
    );
    try {
      const normalized = records.map(validateTender);
      if (
        new Set(normalized.map((t) => t.bidNumber)).size !== normalized.length
      )
        throw new Error(
          "Duplicate bid numbers in batch; submit one complete current version per bid",
        );
      const result = await this.db.transaction(async (m) => {
        await m.query("SELECT pg_advisory_xact_lock(17924001)");
        const rules: Rule[] = await m.query("SELECT * FROM product");
        let inserted = 0,
          updated = 0,
          unchanged = 0;
        for (const t of normalized) {
          const hash = digest(t);
          const existing = (
            await m.query(
              "SELECT * FROM tender WHERE bid_number=$1 FOR UPDATE",
              [t.bidNumber],
            )
          )[0];
          if (existing?.current_hash === hash) {
            unchanged++;
            await m.query("UPDATE tender SET last_checked=now() WHERE id=$1", [
              existing.id,
            ]);
            continue;
          }
          if (
            existing?.revision_at &&
            (!t.revisionAt ||
              new Date(t.revisionAt) < new Date(existing.revision_at))
          )
            throw new Error(
              `Stale or missing source revision for ${t.bidNumber}`,
            );
          const orgExisting = (
            await m.query("SELECT * FROM organization WHERE source_key=$1", [
              t.buyer.key,
            ])
          )[0];
          if (
            orgExisting &&
            (orgExisting.name !== t.buyer.name ||
              orgExisting.state !== stateName(t.buyer.state))
          )
            throw new Error(
              "Buyer key conflicts with existing institution identity; review mapping",
            );
          const orgId = orgExisting?.id || randomUUID();
          if (!orgExisting)
            await m.query(
              "INSERT INTO organization(id,source_key,name,state,district,department,ministry,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
              [
                orgId,
                t.buyer.key,
                t.buyer.name,
                stateName(t.buyer.state),
                t.buyer.district || null,
                t.buyer.department || null,
                t.buyer.ministry || null,
                t.buyer.type || null,
              ],
            );
          const id = existing?.id || randomUUID();
          const args = [
            t.title,
            t.sourceUrl,
            source,
            orgId,
            t.publishedAt || null,
            t.closesAt || null,
            t.status,
            t.estimatedValue ?? null,
            t.emd ?? null,
            t.description,
            t.relatedBidNumber || null,
            t.revisionAt || null,
            hash,
            JSON.stringify(t),
            id,
            t.bidNumber,
          ];
          if (existing) {
            await m.query(
              "UPDATE tender SET title=$1,source_url=$2,source_id=$3,organization_id=$4,published_at=$5,closes_at=$6,status=$7,estimated_value=$8,emd=$9,description=$10,related_bid_number=$11,revision_at=$12,current_hash=$13,raw=$14,updated_at=now(),last_checked=now() WHERE id=$15",
              args.slice(0, 15),
            );
            updated++;
          } else {
            await m.query(
              "INSERT INTO tender(title,source_url,source_id,organization_id,published_at,closes_at,status,estimated_value,emd,description,related_bid_number,revision_at,current_hash,raw,id,bid_number) VALUES(" +
                args.map((_, i) => `$${i + 1}`).join(",") +
                ")",
              args,
            );
            inserted++;
          }
          await m.query(
            "INSERT INTO tender_version(id,tender_id,hash,run_id,raw) VALUES($1,$2,$3,$4,$5)",
            [randomUUID(), id, hash, runId, JSON.stringify(t)],
          );
          await m.query("DELETE FROM line_item WHERE tender_id=$1", [id]);
          await m.query("DELETE FROM document WHERE tender_id=$1", [id]);
          for (const d of t.documents)
            await m.query("INSERT INTO document VALUES($1,$2,$3,$4,$5)", [
              randomUUID(),
              id,
              d.url,
              d.label,
              d.sha256 || null,
            ]);
          for (const i of t.items) {
            const manual = (
              await m.query(
                "SELECT * FROM correction WHERE tender_id=$1 AND source_key=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
                [id, i.key],
              )
            )[0];
            const c = classify(i.name, rules);
            const li = randomUUID();
            await m.query(
              "INSERT INTO line_item VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
              [
                li,
                id,
                i.key,
                i.name,
                manual ? manual.product_id : c.productId,
                i.quantity ?? null,
                i.unit,
                i.estimatedValue ?? null,
                i.evidence,
                manual ? 1 : c.confidence,
                manual ? "Manual correction: " + manual.reason : c.reason,
                manual ? false : c.review,
              ],
            );
            for (const d of i.destinations)
              await m.query(
                "INSERT INTO destination VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
                [
                  randomUUID(),
                  li,
                  d.state,
                  d.district || null,
                  d.city || null,
                  d.confirmed,
                  d.quantity ?? null,
                  d.evidence,
                ],
              );
          }
        }
        await m.query(
          "UPDATE collection_run SET status='succeeded',finished_at=now(),inserted=$2,updated=$3,unchanged=$4 WHERE id=$1",
          [runId, inserted, updated, unchanged],
        );
        await m.query("UPDATE source SET last_success=now() WHERE id=$1", [
          source,
        ]);
        return { runId, inserted, updated, unchanged };
      });
      return result;
    } catch (e) {
      await this.db.query(
        "UPDATE collection_run SET status='failed',finished_at=now(),rejected=discovered,error=$2 WHERE id=$1",
        [runId, (e as Error).message.slice(0, 2000)],
      );
      throw e;
    }
  }
  async correct(lineId: string, productId: string | null, reason: string) {
    return this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(17924001)");
      const item = (
        await m.query("SELECT * FROM line_item WHERE id=$1", [lineId])
      )[0];
      if (!item) throw new Error("Line item not found");
      await m.query(
        "INSERT INTO correction(id,tender_id,source_key,product_id,reason,actor) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          item.tender_id,
          item.source_key,
          productId,
          reason,
          "administrator",
        ],
      );
      await m.query(
        "UPDATE line_item SET product_id=$2,confidence=1,classification_reason=$3,needs_review=false WHERE id=$1",
        [lineId, productId, "Manual correction: " + reason],
      );
      return { corrected: true };
    });
  }
}
