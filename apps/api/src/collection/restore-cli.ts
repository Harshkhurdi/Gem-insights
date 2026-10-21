import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connect, db } from "../database";
import { Collection } from "./service";
import { getSource } from "./registry";
import { noticeClassification } from "./parsers";
import { stateName } from "../../../../packages/core/domain";
const link = z
  .string()
  .url()
  .max(8192)
  .refine((v) => /^https?:$/.test(new URL(v).protocol));
const notice = z
  .object({
    key: z.string().min(1).max(1000),
    bidNumber: z.string().min(1).max(1000).nullable(),
    portal: z.enum(["gem", "cppp", "state", "institution"]),
    title: z.string().min(1).max(2000),
    url: link,
    documents: z.array(link).max(1000),
    publishedAt: z.string().date().nullable(),
    closingDate: z.string().date().nullable(),
    buyer: z.string().max(2000).nullable(),
    state: z.string().nullable(),
    medical: z.boolean(),
    products: z.array(z.string()),
    reason: z.string().max(2000),
  })
  .strict();
async function main() {
  const path = process.argv[2] || "data/discovery-baseline.json.gz";
  const bytes = await readFile(path);
  const content = (
    path.endsWith(".gz")
      ? gunzipSync(bytes, { maxOutputLength: 20_000_000 })
      : bytes
  ).toString("utf8");
  if (Buffer.byteLength(content) > 20_000_000)
    throw new Error("Discovery snapshot exceeds 20 MB");
  const snapshot = z
    .object({
      version: z.literal(1),
      collectedAt: z.string().datetime(),
      records: z
        .array(z.object({ source_id: z.string(), raw: notice }).strict())
        .max(20000),
    })
    .passthrough()
    .parse(JSON.parse(content));
  for (const r of snapshot.records) {
    getSource(r.source_id);
    stateName(r.raw.state);
  }
  await connect();
  try {
    const collection = new Collection(db),
      rules = await db.query("SELECT * FROM product");
    let inserted = 0,
      updated = 0,
      unchanged = 0;
    for (const sourceId of [
      ...new Set(snapshot.records.map((r) => r.source_id)),
    ]) {
      const records = snapshot.records
        .filter((r) => r.source_id === sourceId)
        .map((r) => ({
          ...r.raw,
          ...noticeClassification(r.raw.title, rules),
        }));
      const runId = randomUUID();
      await db.transaction(async (m) => {
        await m.query("SELECT pg_advisory_xact_lock(17924003,hashtext($1))", [
          sourceId,
        ]);
        await m.query(
          "INSERT INTO collection_run(id,source_id,status,discovered,provenance) VALUES($1,$2,'running',$3,$4)",
          [
            runId,
            sourceId,
            records.length,
            `Historical listing snapshot collected ${snapshot.collectedAt}; imported locally; quantities unverified`,
          ],
        );
        const existing = await m.query(
          "SELECT external_key,last_seen FROM discovered_notice WHERE source_id=$1",
          [sourceId],
        );
        const recentKeys = new Set(
          existing
            .filter(
              (n: any) =>
                new Date(n.last_seen) > new Date(snapshot.collectedAt),
            )
            .map((n: any) => n.external_key),
        );
        const eligible = records.filter((n) => !recentKeys.has(n.key));
        const stats = await collection.store(m, sourceId, runId, eligible);
        stats.unchanged += records.length - eligible.length;
        if (eligible.length)
          await m.query(
            "UPDATE discovered_notice SET last_seen=$3,first_seen=LEAST(first_seen,$3::timestamptz) WHERE source_id=$1 AND external_key=ANY($2::text[])",
            [sourceId, eligible.map((n) => n.key), snapshot.collectedAt],
          );
        inserted += stats.inserted;
        updated += stats.updated;
        unchanged += stats.unchanged;
        await m.query(
          "UPDATE collection_run SET status='succeeded',finished_at=now(),inserted=$2,updated=$3,unchanged=$4 WHERE id=$1",
          [runId, stats.inserted, stats.updated, stats.unchanged],
        );
      });
    }
    console.log(
      JSON.stringify({
        inserted,
        updated,
        unchanged,
        verifiedEquipmentQuantitiesAdded: 0,
      }),
    );
  } finally {
    await db.destroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
