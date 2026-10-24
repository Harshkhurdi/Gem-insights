import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { request as httpsRequest, Agent as HttpsAgent } from "node:https";
import sslConstants from "node:constants";
import { sectigoPublicServerDvR36 } from "./tls-intermediates";
import { rootCertificates } from "node:tls";
import { DataSource, EntityManager } from "typeorm";
import {
  digest,
  validateTender,
  STATES,
} from "../../../../packages/core/domain";
import { Ingestion } from "../ingestion";
import { getSource } from "./registry";
import { Notice, pageAllowed, parseListing } from "./parsers";
import { collectionRegion, collectionSources } from "./regions";

// Some official state health sites (currently PHSC Punjab) still require TLS
// legacy renegotiation, which Node's default fetch rejects as unsafe. A
// compatibility path is restricted to these explicit public listing hosts;
// it changes the TLS mode only and adds no access bypass.
const LEGACY_TLS_HOSTS = new Set(["phsc.punjab.gov.in"]);
const legacyTlsAgent = new HttpsAgent({
  secureOptions: sslConstants.SSL_OP_LEGACY_SERVER_CONNECT,
});
// Some official publishers serve only their leaf certificate without the
// intermediate their issuer references. For these explicit hosts the named
// public intermediate is bundled and verification stays fully enabled; every
// other host continues to use Node's default trust store.
const INCOMPLETE_CHAIN_HOSTS = new Set(["jipmer.edu.in"]);
const chainFixAgent = new HttpsAgent({
  ca: [...rootCertificates, sectigoPublicServerDvR36],
});
function fetchCompatibilityListing(
  url: string,
  agent: HttpsAgent,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        agent,
        timeout: 30000,
        headers: {
          Accept: "text/html",
          "User-Agent":
            "GemInsights/0.2 (public procurement metadata; local research)",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `Source returned HTTP ${res.statusCode}; no access bypass attempted`,
            ),
          );
          return;
        }
        if (
          !/text\/html|application\/xhtml/i.test(
            res.headers["content-type"] || "",
          )
        ) {
          res.resume();
          reject(new Error("Expected HTML listing"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 5_000_000) {
            req.destroy(new Error("Listing exceeds 5 MB page budget"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Listing timed out")));
    req.on("error", reject);
    req.end();
  });
}
export async function fetchListing(url: string): Promise<string> {
  const hostname = new URL(url).hostname;
  if (LEGACY_TLS_HOSTS.has(hostname))
    return fetchCompatibilityListing(url, legacyTlsAgent);
  if (INCOMPLETE_CHAIN_HOSTS.has(hostname))
    return fetchCompatibilityListing(url, chainFixAgent);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      Accept: "text/html",
      "User-Agent":
        "GemInsights/0.2 (public procurement metadata; local research)",
    },
  });
  if (!response.ok)
    throw new Error(
      `Source returned HTTP ${response.status}; no access bypass attempted`,
    );
  if (
    !/text\/html|application\/xhtml/i.test(
      response.headers.get("content-type") || "",
    )
  )
    throw new Error("Expected HTML listing");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty listing response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 5_000_000) throw new Error("Listing exceeds 5 MB page budget");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export class Collection {
  constructor(
    private db: DataSource,
    private fetchPage = fetchListing,
    private pageDelayMs = 2000,
    private pageBudget = 25,
  ) {
    if (!Number.isInteger(pageBudget) || pageBudget < 1 || pageBudget > 100)
      throw new Error("Page budget must be between 1 and 100");
  }
  async queue(sourceId?: string) {
    const eligible = sourceId ? [getSource(sourceId)] : collectionSources();
    if (eligible.some((s) => !s.adapter))
      throw new Error(
        "This source needs assisted import; no automated adapter available",
      );
    const ids: string[] = [];
    for (const s of eligible) {
      const rows = await this.db.query(
        "INSERT INTO job(id,kind,payload) SELECT $1,'collect',jsonb_build_object('sourceId',$2::text) FROM source WHERE id=$2 AND enabled ON CONFLICT DO NOTHING RETURNING id",
        [randomUUID(), s.id],
      );
      ids.push(...rows.map((r: any) => r.id));
    }
    return {
      queued: ids.length,
      jobIds: ids,
      status: ids.length ? "queued" : "already_queued_or_disabled",
    };
  }
  async schedule() {
    const due = new Set(
      (
        await this.db.query(
          "SELECT id FROM source WHERE enabled AND adapter IS NOT NULL AND next_collection_at<=now()",
        )
      ).map((s: { id: string }) => s.id),
    );
    for (const source of collectionSources())
      if (due.has(source.id)) await this.queue(source.id);
  }
  async store(
    m: EntityManager,
    sourceId: string,
    runId: string,
    notices: Notice[],
  ) {
    let inserted = 0,
      updated = 0,
      unchanged = 0;
    for (const n of notices) {
      // CPPP detail links contain rotating transport tokens; identity comes from
      // the source-recorded reference, not those tokens. Keep the latest link.
      const hash = digest(
        getSource(sourceId).adapter === "cppp" && n.bidNumber
          ? { ...n, url: "" }
          : n,
      );
      const old = (
        await m.query(
          "SELECT id,current_hash FROM discovered_notice WHERE source_id=$1 AND external_key=$2 FOR UPDATE",
          [sourceId, n.key],
        )
      )[0];
      const id = old?.id || randomUUID();
      if (old?.current_hash === hash) {
        unchanged++;
        await m.query(
          "UPDATE discovered_notice SET last_seen=now(),source_url=$2,raw=$3 WHERE id=$1",
          [id, n.url, JSON.stringify(n)],
        );
        continue;
      }
      await m.query(
        `INSERT INTO discovered_notice(id,source_id,external_key,bid_number,source_portal,title,source_url,documents,published_at,closing_date,buyer_name,buyer_state,medical_candidate,products,classification_reason,current_hash,raw)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT(source_id,external_key) DO UPDATE SET bid_number=EXCLUDED.bid_number,source_portal=EXCLUDED.source_portal,title=EXCLUDED.title,source_url=EXCLUDED.source_url,documents=EXCLUDED.documents,published_at=EXCLUDED.published_at,closing_date=EXCLUDED.closing_date,buyer_name=EXCLUDED.buyer_name,buyer_state=EXCLUDED.buyer_state,medical_candidate=EXCLUDED.medical_candidate,products=EXCLUDED.products,classification_reason=EXCLUDED.classification_reason,current_hash=EXCLUDED.current_hash,raw=EXCLUDED.raw,last_seen=now(),review_status='pending',review_reason='Source listing changed; review again',reviewed_at=NULL`,
        [
          id,
          sourceId,
          n.key,
          n.bidNumber,
          n.portal,
          n.title,
          n.url,
          JSON.stringify(n.documents),
          n.publishedAt,
          n.closingDate,
          n.buyer,
          n.state,
          n.medical,
          JSON.stringify(n.products),
          n.reason,
          hash,
          JSON.stringify(n),
        ],
      );
      await m.query(
        "INSERT INTO notice_observation(id,notice_id,run_id,hash,raw) VALUES($1,$2,$3,$4,$5) ON CONFLICT(notice_id,hash) DO NOTHING",
        [randomUUID(), id, runId, hash, JSON.stringify(n)],
      );
      if (old) updated++;
      else inserted++;
    }
    return { inserted, updated, unchanged };
  }
  async run(sourceId: string, stop = () => false) {
    const lock = this.db.createQueryRunner();
    await lock.connect();
    let acquired = false;
    try {
      acquired = (
        await lock.query(
          "SELECT pg_try_advisory_lock(17924003,hashtext($1)) AS locked",
          [sourceId],
        )
      )[0].locked;
      if (!acquired)
        throw new Error("Another collector is already running for this source");
      return await this.runLocked(sourceId, stop);
    } finally {
      try {
        if (acquired)
          await lock.query("SELECT pg_advisory_unlock(17924003,hashtext($1))", [
            sourceId,
          ]);
      } finally {
        await lock.release();
      }
    }
  }
  private async runLocked(sourceId: string, stop = () => false) {
    const source = getSource(sourceId);
    if (!source.adapter) throw new Error("Automated adapter unavailable");
    const row = (
      await this.db.query("SELECT * FROM source WHERE id=$1", [sourceId])
    )[0];
    if (!row?.enabled) return { disabled: true };
    let pageUrl = row.checkpoint || source.url;
    if (!pageAllowed(pageUrl, source))
      throw new Error("Invalid saved listing checkpoint");
    const runId = randomUUID();
    await this.db.query(
      "INSERT INTO collection_run(id,source_id,status,provenance) VALUES($1,$2,'running',$3)",
      [
        runId,
        sourceId,
        `Public listing metadata: ${source.url}. Coverage partial; quantities unverified.`,
      ],
    );
    await this.db.query(
      "UPDATE source SET last_attempt=now(),last_error=NULL WHERE id=$1",
      [sourceId],
    );
    const rules = await this.db.query("SELECT * FROM product");
    const visited = new Set<string>();
    let pages = 0;
    const savePage = async (
      parsed: ReturnType<typeof parseListing>,
      advanceCheckpoint: boolean,
    ) => {
      await this.db.transaction(async (m) => {
        const stats = await this.store(m, sourceId, runId, parsed.notices);
        await m.query(
          "UPDATE collection_run SET discovered=discovered+$2,inserted=inserted+$3,updated=updated+$4,unchanged=unchanged+$5 WHERE id=$1",
          [
            runId,
            parsed.notices.length,
            stats.inserted,
            stats.updated,
            stats.unchanged,
          ],
        );
        if (advanceCheckpoint)
          await m.query("UPDATE source SET checkpoint=$2 WHERE id=$1", [
            sourceId,
            parsed.next,
          ]);
      });
    };
    try {
      // Keep the newest notices fresh while a large historical listing is scanned.
      // Refreshing the head never rewinds the durable backfill checkpoint.
      if (row.checkpoint && row.checkpoint !== source.url) {
        let head: string | null = source.url;
        const headSeen = new Set<string>();
        for (
          let i = 0;
          i < Math.min(3, this.pageBudget - 1) && head && !stop();
          i++
        ) {
          if (headSeen.has(head)) throw new Error("Cyclic head pagination");
          headSeen.add(head);
          const parsed = parseListing(
            await this.fetchPage(head),
            source,
            head,
            rules,
          );
          await savePage(parsed, false);
          pages++;
          head = parsed.next;
          if (head) await delay(this.pageDelayMs);
        }
      }
      while (pages < this.pageBudget && !stop()) {
        if (visited.has(pageUrl))
          throw new Error("Cyclic pagination; checkpoint retained");
        visited.add(pageUrl);
        const parsed = parseListing(
          await this.fetchPage(pageUrl),
          source,
          pageUrl,
          rules,
        );
        if (parsed.next && visited.has(parsed.next))
          throw new Error("Cyclic pagination; checkpoint retained");
        await savePage(parsed, true);
        pages++;
        if (!parsed.next) {
          await this.db.query(
            "UPDATE collection_run SET status='succeeded',finished_at=now() WHERE id=$1",
            [runId],
          );
          await this.db.query(
            "UPDATE source SET last_success=now(),last_error=NULL,next_collection_at=now()+interval_minutes*interval '1 minute' WHERE id=$1",
            [sourceId],
          );
          return { runId, pages, coverage: "partial" };
        }
        pageUrl = parsed.next;
        await delay(this.pageDelayMs);
      }
      await this.db.query(
        "UPDATE collection_run SET status='partial',finished_at=now(),error='Page budget or worker shutdown; checkpoint saved' WHERE id=$1",
        [runId],
      );
      await this.db.query(
        "UPDATE source SET next_collection_at=now()+interval '15 minutes' WHERE id=$1",
        [sourceId],
      );
      return { runId, pages, coverage: "partial", checkpoint: pageUrl };
    } catch (e) {
      const message = (e as Error).message.slice(0, 2000);
      await this.db.query(
        "UPDATE collection_run SET status='failed',finished_at=now(),error=$2 WHERE id=$1",
        [runId, message],
      );
      await this.db.query(
        "UPDATE source SET last_error=$2,next_collection_at=now()+interval '30 minutes' WHERE id=$1",
        [sourceId, message],
      );
      throw e;
    }
  }
  async summary() {
    const [sources, counts, states, products] = await Promise.all([
      this.db.query(
        `SELECT s.*,count(n.id)::int AS notices,count(n.id) FILTER(WHERE n.medical_candidate)::int AS medical_candidates FROM source s LEFT JOIN discovered_notice n ON n.source_id=s.id WHERE s.listing_url IS NOT NULL GROUP BY s.id ORDER BY (s.adapter IS NOT NULL) DESC,s.name`,
      ),
      this.db.query(
        `SELECT count(*)::int AS notices,count(*) FILTER(WHERE medical_candidate)::int AS medical_candidates,count(*) FILTER(WHERE review_status='pending')::int AS pending,count(*) FILTER(WHERE review_status='approved')::int AS approved FROM discovered_notice`,
      ),
      this.db.query(
        `SELECT buyer_state,count(*)::int AS notices FROM discovered_notice GROUP BY buyer_state`,
      ),
      this.db.query(
        `SELECT p.id,p.name,count(*)::int AS notices FROM discovered_notice n CROSS JOIN LATERAL jsonb_array_elements_text(n.products) candidate JOIN product p ON p.id=candidate.value GROUP BY p.id,p.name ORDER BY notices DESC,p.name`,
      ),
    ]);
    return {
      collectionRegion: collectionRegion(),
      sources,
      counts: counts[0],
      products,
      states: STATES.map((state) => ({
        state,
        registered: sources.filter((s: any) => s.states.includes(state)).length,
        automated: sources.filter(
          (s: any) => s.states.includes(state) && s.adapter && s.enabled,
        ).length,
        notices: states.find((s: any) => s.buyer_state === state)?.notices || 0,
      })),
      nationalCompleteness: null,
    };
  }
  async notices(q: {
    search?: string;
    source?: string;
    state?: string;
    medical?: boolean;
    status?: string;
    product?: string;
    page: number;
  }) {
    const params: unknown[] = [];
    const where = ["true"];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (q.search)
      where.push(
        `(n.title ILIKE ${add("%" + q.search + "%")} OR n.bid_number ILIKE $${params.length})`,
      );
    if (q.source) where.push(`n.source_id=${add(q.source)}`);
    if (q.state) where.push(`n.buyer_state=${add(q.state)}`);
    if (q.medical != null) where.push(`n.medical_candidate=${add(q.medical)}`);
    if (q.status) where.push(`n.review_status=${add(q.status)}`);
    if (q.product) where.push(`n.products ? ${add(q.product)}`);
    const clause = where.join(" AND ");
    const total = (
      await this.db.query(
        `SELECT count(*)::int AS total FROM discovered_notice n WHERE ${clause}`,
        params,
      )
    )[0].total;
    const rows = await this.db.query(
      `SELECT n.*,s.name AS source_name FROM discovered_notice n JOIN source s ON s.id=n.source_id WHERE ${clause} ORDER BY n.last_seen DESC,n.id LIMIT 25 OFFSET ${add((q.page - 1) * 25)}`,
      params,
    );
    return { rows, total, page: q.page, limit: 25 };
  }
  async detail(id: string) {
    const notice = (
      await this.db.query("SELECT * FROM discovered_notice WHERE id=$1", [id])
    )[0];
    if (!notice) throw new Error("Notice not found");
    const tender = notice.bid_number
      ? (
          await this.db.query(
            "SELECT id,current_hash,raw FROM tender WHERE source_portal=$1 AND bid_number=$2",
            [notice.source_portal, notice.bid_number],
          )
        )[0]
      : null;
    const documents = await this.db.query(
      "SELECT l.source_url,l.document_id,l.notice_hash,d.status,d.error,x.record AS draft_record,x.warnings FROM notice_document_link l JOIN upload_document d ON d.id=l.document_id LEFT JOIN extraction_draft x ON x.document_id=d.id WHERE l.notice_id=$1 ORDER BY l.created_at DESC",
      [id],
    );
    return {
      notice,
      currentTender: tender || null,
      extractedDocuments: documents,
    };
  }
  async approve(
    id: string,
    body: {
      expectedHash: string;
      expectedTenderHash: string | null;
      record: unknown;
      reason: string;
    },
  ) {
    const t = validateTender(body.record);
    return this.db.transaction(async (m) => {
      await m.query("SELECT pg_advisory_xact_lock(17924001)");
      const existing = (
        await m.query(
          "SELECT current_hash FROM tender WHERE source_portal=$1 AND bid_number=$2 FOR UPDATE",
          [t.sourcePortal, t.bidNumber],
        )
      )[0];
      if ((existing?.current_hash || null) !== body.expectedTenderHash)
        throw new Error(
          "Tender changed since review began; reload and compare the latest complete snapshot",
        );
      const n = (
        await m.query(
          "SELECT * FROM discovered_notice WHERE id=$1 FOR UPDATE",
          [id],
        )
      )[0];
      if (!n || n.current_hash !== body.expectedHash)
        throw new Error("Notice changed or not found; reload before reviewing");
      if (n.review_status === "approved")
        throw new Error("Notice already approved");
      if (
        t.sourceUrl !== n.source_url ||
        t.sourcePortal !== n.source_portal ||
        (n.bid_number && t.bidNumber !== n.bid_number)
      )
        throw new Error(
          "Keep the collected portal, reference and original source URL",
        );
      if (t.items.some((i) => !i.evidence.trim()))
        throw new Error("Each reviewed line requires original evidence");
      const result = await new Ingestion(this.db).import(
        [t],
        `Reviewed public notice: ${body.reason}`,
        n.source_id,
        m,
      );
      const tender = (
        await m.query(
          "SELECT id FROM tender WHERE source_portal=$1 AND bid_number=$2",
          [t.sourcePortal, t.bidNumber],
        )
      )[0];
      await m.query(
        "UPDATE discovered_notice SET review_status='approved',review_reason=$2,reviewed_at=now(),tender_id=$3 WHERE id=$1",
        [id, body.reason, tender.id],
      );
      return result;
    });
  }
}
