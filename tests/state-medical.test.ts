import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { migrations } from "../apps/api/src/migrations";
import { StateMedicalCoverage1792414000000 } from "../apps/api/src/migrations/state-medical-coverage";
import { refreshNoticeClassifications } from "../apps/api/src/migrations/institution-coverage";
import {
  parseListing,
  pageAllowed,
  noticeClassification,
  noticeKey,
} from "../apps/api/src/collection/parsers";
import { getSource } from "../apps/api/src/collection/registry";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { Ingestion } from "../apps/api/src/ingestion";
import { digest } from "../packages/core/domain";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmscTable, rmscRow, upumsTable } from "./state-medical-fixtures";
const equipment = getSource("rmsc-equipment"),
  drugs = getSource("rmsc-drugs"),
  upums = getSource("upums");
test("RMSC combines source name/description, retains article/attachments, and never substitutes generic or bulk-upload dates", () => {
  const n = parseListing(rmscTable(), equipment).notices[0];
  assert.equal(n.title, "SYNTHETIC NIB-110 — Supply of Microscopes");
  assert.equal(n.bidNumber, null);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.buyer, "Rajasthan Medical Services Corporation");
  assert.equal(n.state, "Rajasthan");
  assert.match(n.url, /notice-110.html$/);
  assert.equal(n.documents.length, 3);
  assert.equal(n.medical, true);
  assert.ok(n.products.includes("microscopes"));
  assert.equal("quantity" in n, false);
});
test("only the explicit drug/surgical category adds clinical scope to an otherwise unclassified notice", () => {
  const html = rmscTable(rmscRow("SYNTHETIC Corrigendum NIB-11", ""));
  const n = parseListing(html, drugs).notices[0];
  assert.equal(n.medical, true);
  assert.deepEqual(n.products, []);
  assert.match(n.reason, /official drug\/surgical tender category/);
  assert.equal(parseListing(html, equipment).notices[0].medical, false);
  assert.equal(noticeClassification("SYNTHETIC Office chairs").medical, false);
});
test("RMSC notices sharing a short NIB label keep separate article identities; blank separator rows do not become notices", () => {
  const p = parseListing(
    rmscTable(
      rmscRow() +
        rmscRow(
          "SYNTHETIC NIB-110",
          "Supply of Microscopes",
          "different.html",
        ) +
        '<tr><td colspan="6"></td></tr>',
    ),
    equipment,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
});
test("missing RMSC article links use attachments or distinct source-listing fallbacks with restorable keys", () => {
  const attachment = parseListing(
    rmscTable(rmscRow(undefined, undefined, "javascript:download()")),
    equipment,
  ).notices[0];
  assert.match(attachment.url, /original.pdf$/);
  const p = parseListing(
    rmscTable(
      rmscRow("SYNTHETIC Reagents", "", "#", "") +
        rmscRow("SYNTHETIC Catheters", "", "#", ""),
    ),
    equipment,
  );
  assert.equal(p.notices.length, 2);
  for (const n of p.notices) {
    assert.equal(n.url, equipment.url);
    assert.equal(n.key, noticeKey(equipment, n.bidNumber, n.url, n.title));
  }
});
test("UPUMS retains explicit publication and document links with unknown closing/quantity fields", () => {
  const n = parseListing(
    upumsTable("SYNTHETIC Patient monitors GEM/2026/B/123456"),
    upums,
  ).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.equal(n.publishedAt, "2026-10-20");
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Uttar Pradesh");
  assert.equal(n.documents.length, 1);
  assert.equal("quantity" in n, false);
  assert.equal(
    parseListing(upumsTable(undefined, undefined, "31/02/2026"), upums)
      .notices[0].publishedAt,
    null,
  );
});
test("duplicate UPUMS document rows group once while missing-document notices stay distinct", () => {
  const duplicate = upumsTable().replace(
    "</table>",
    upumsTable().match(/<tr><td>.*<\/tr>/)![0] + "</table>",
  );
  assert.equal(parseListing(duplicate, upums).notices.length, 1);
  const p = parseListing(
    upumsTable(undefined, "").replace(
      "</table>",
      upumsTable("SYNTHETIC Reagents", "").match(/<tr><td>.*<\/tr>/)![0] +
        "</table>",
    ),
    upums,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
});
test("new profiles reject unsupported category/pagination switches and missing layouts", () => {
  for (const s of [equipment, drugs, upums]) {
    assert.equal(pageAllowed(s.url, s), true);
    assert.equal(pageAllowed(s.url + "?page=2", s), false);
    assert.throws(
      () => parseListing("<h1>Temporarily unavailable</h1>", s),
      /table missing/,
    );
  }
  assert.equal(pageAllowed(drugs.url, equipment), false);
  assert.throws(
    () =>
      parseListing(
        rmscTable() + '<a rel="next" href="?page=2">Next</a>',
        equipment,
      ),
    /pagination/,
  );
});

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  analytics = new Analytics(db);
const f = (extra: any = {}) =>
  filterSchema.parse({ medical: "true", ...extra });
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL,next_collection_at=now(),last_error=NULL",
  );
});
const collect = (html: string, id: string) =>
  new Collection(db, async () => html, 0).run(id);
test("Rajasthan and UP listings appear immediately in main insights with unknown quantities and publisher-only geography", async () => {
  await collect(rmscTable(), equipment.id);
  await collect(upumsTable(), upums.id);
  assert.equal((await analytics.overview(f())).tenders, 2);
  assert.equal((await analytics.overview(f())).known_value, null);
  assert.deepEqual(
    new Set((await analytics.states(f())).map((s: any) => s.state)),
    new Set(["Rajasthan", "Uttar Pradesh"]),
  );
  assert.ok(
    (await analytics.products(f())).every((p: any) =>
      Object.values(p.quantities).every((q) => q === null),
    ),
  );
  assert.equal((await analytics.trends(f())).length, 1);
  assert.equal((await analytics.trends(f()))[0].product_id, "patient-monitors");
  assert.deepEqual(await analytics.states(f({ basis: "delivery" })), []);
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
});
test("generic clinical-category notices remain visible without fabricating a product family or publication date", async () => {
  await collect(
    rmscTable(rmscRow("SYNTHETIC Corrigendum NIB-11", "")),
    drugs.id,
  );
  assert.equal((await analytics.overview(f())).medical_tenders, 1);
  assert.deepEqual(await analytics.products(f()), []);
  assert.deepEqual(await analytics.trends(f()), []);
});
test("repeat collection and derived-label refresh preserve drug-category decisions and source-aware classification hashes", async () => {
  const html = rmscTable(rmscRow("SYNTHETIC Corrigendum NIB-11", ""));
  await collect(html, drugs.id);
  const [n] = await db.query("SELECT * FROM discovered_notice"),
    raw = { ...n.raw, medical: false, reason: "SYNTHETIC legacy label" };
  await db.query(
    "UPDATE discovered_notice SET raw=$2,current_hash=$3,medical_candidate=false,review_status='dismissed',last_seen='2026-10-19T00:00:00Z' WHERE id=$1",
    [n.id, JSON.stringify(raw), digest(raw)],
  );
  await db.transaction((q) => refreshNoticeClassifications(q));
  const [updated] = await db.query("SELECT * FROM discovered_notice");
  assert.equal(updated.medical_candidate, true);
  assert.equal(updated.review_status, "dismissed");
  assert.equal(
    new Date(updated.last_seen).toISOString(),
    "2026-10-19T00:00:00.000Z",
  );
  await collect(html, drugs.id);
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
    1,
  );
});
test("explicit GeM references group across new sources and reviewed records replace signals without doubling quantities", async () => {
  const title = "SYNTHETIC Patient monitors GEM/2026/B/123456";
  await collect(rmscTable(rmscRow(title, "")), equipment.id);
  await collect(upumsTable(title), upums.id);
  assert.equal((await analytics.overview(f())).tenders, 1);
  await new Ingestion(db).import(
    [
      {
        bidNumber: "GEM/2026/B/123456",
        title: "SYNTHETIC Reviewed patient monitors",
        sourceUrl: "https://www.upums.ac.in/files/upums.pdf",
        publishedAt: "2026-10-20",
        buyer: {
          key: "SYNTHETIC-UPUMS",
          name: upums.name,
          state: "Uttar Pradesh",
        },
        items: [
          {
            key: "one",
            name: "Patient monitors",
            quantity: "3",
            unit: "units",
            evidence: "SYNTHETIC reviewed original page 1",
          },
        ],
      },
    ],
    "SYNTHETIC reviewed data",
  );
  assert.equal((await analytics.overview(f())).tenders, 1);
  assert.equal((await analytics.products(f()))[0].quantities.units, 3);
  assert.equal(
    (await analytics.overview(f({ source: equipment.id }))).tenders,
    1,
  );
});
test("additive state-medical migration preserves collector pauses, unrelated checkpoints and existing reviews", async () => {
  await collect(upumsTable(), upums.id);
  await db.query("UPDATE discovered_notice SET review_status='dismissed'");
  await db.query("UPDATE source SET enabled=false WHERE id=$1", [upums.id]);
  await db.query(
    "UPDATE source SET checkpoint=$1 WHERE id='aiims-delhi-archive-open'",
    [getSource("aiims-delhi-archive-open").url + "?start=50"],
  );
  await db.query(
    "UPDATE source SET adapter=NULL,enabled=false,listing_url='https://rmsc.health.rajasthan.gov.in/',checkpoint='https://rmsc.health.rajasthan.gov.in/old' WHERE id=$1",
    [equipment.id],
  );
  await db.transaction((q) => new StateMedicalCoverage1792414000000().up(q));
  const [e] = await db.query("SELECT * FROM source WHERE id=$1", [
    equipment.id,
  ]);
  assert.equal(e.enabled, true);
  assert.equal(e.checkpoint, null);
  assert.equal(
    (await db.query("SELECT enabled FROM source WHERE id=$1", [upums.id]))[0]
      .enabled,
    false,
  );
  assert.match(
    (
      await db.query(
        "SELECT checkpoint FROM source WHERE id='aiims-delhi-archive-open'",
      )
    )[0].checkpoint,
    /start=50$/,
  );
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
});

test("snapshot CLI restores source-category clinical labels and repeats without resetting a review decision or observation age", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gem-state-synthetic-"));
  const file = join(dir, "snapshot.json");
  const n = parseListing(
    rmscTable(rmscRow("SYNTHETIC Corrigendum NIB-11", "")),
    drugs,
  ).notices[0];
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      collectedAt: "2026-10-20T00:00:00.000Z",
      records: [
        {
          source_id: drugs.id,
          raw: { ...n, medical: false, reason: "SYNTHETIC old category label" },
        },
      ],
    }),
  );
  const restore = () =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "apps/api/src/collection/restore-cli.ts", file],
        {
          env: { ...process.env, DATABASE_URL: url },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      child.on("error", reject);
      child.on("exit", (code, signal) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`Snapshot child failed ${code}/${signal}: ${output}`),
            ),
      );
    });
  try {
    await restore();
    const [first] = await db.query("SELECT * FROM discovered_notice");
    assert.equal(first.medical_candidate, true);
    assert.match(first.raw.reason, /official drug\/surgical tender category/);
    assert.equal(
      new Date(first.last_seen).toISOString(),
      "2026-10-20T00:00:00.000Z",
    );
    await db.query("UPDATE discovered_notice SET review_status='dismissed'");
    await restore();
    const [second] = await db.query("SELECT * FROM discovered_notice");
    assert.equal(second.id, first.id);
    assert.equal(second.current_hash, first.current_hash);
    assert.equal(second.review_status, "dismissed");
    assert.equal(
      new Date(second.first_seen).toISOString(),
      "2026-10-20T00:00:00.000Z",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM discovered_notice"))[0].n,
      1,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
