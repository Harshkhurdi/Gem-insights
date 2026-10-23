import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import {
  noticeKind,
  NOTICE_KINDS,
  NON_DEMAND_NOTICE_KINDS,
} from "../packages/core/notice-kind";
import { migrations } from "../apps/api/src/migrations";
import { NoticeLifecycle1792419000000 } from "../apps/api/src/migrations/notice-lifecycle";
import { parseListing, pageAllowed } from "../apps/api/src/collection/parsers";
import { getSource, SOURCES } from "../apps/api/src/collection/registry";
import { Collection } from "../apps/api/src/collection/service";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
const s = getSource("safdarjung");
const row = (title: string, file = "/sites/default/files/original.pdf") =>
  `<tr><td>1</td><td>${title}</td><td>30/06/2026</td><td>${file ? `<a href="${file}">Original</a><a href="/sites/default/files/amendment.pdf">Amendment</a>` : ""}</td></tr>`;
const table = (rows = row("SYNTHETIC Tender for patient monitors")) =>
  `<title>Tenders | Safdarjung Hospital</title><table><thead><tr><th>Sr. No. / क्रमांक</th><th>Title / शीर्षक</th><th>Date / तारीख</th><th>Download / डाउनलोड</th></tr></thead><tbody>${rows}</tbody></table>`;
const examples = [
  ["SYNTHETIC Tender for patient monitors", "procurement"],
  ["SYNTHETIC Corrigendum for patient monitors", "amendment"],
  ["SYNTHETIC Cancellation of tender for patient monitors", "cancellation"],
  ["SYNTHETIC Award of Contract for Procurement of ventilators", "award"],
  ["SYNTHETIC Supply Order for patient monitors", "award"],
  ["SYNTHETIC E-AUCTION for medical equipment", "disposal"],
  [
    "SYNTHETIC List of Medical Equipments procured w.e.f. 01.04.2026",
    "purchase_report",
  ],
  [
    "SYNTHETIC Procured for the period 1.4.2016 to 30.6.2016",
    "purchase_report",
  ],
  ["SYNTHETIC List Of Equipment Procure In 2016-2017", "purchase_report"],
  ["SYNTHETIC Various Proformas for Requisition of Equipment", "reference"],
  ["SYNTHETIC Patient monitors", "unknown"],
] as const;
for (const [title, kind] of examples)
  test(`notice type: ${kind} — ${title}`, () =>
    assert.equal(noticeKind(title), kind));
test("conservative lifecycle rules keep unclear notices and actual waste-disposal service procurement eligible", () => {
  assert.equal(
    noticeKind("SYNTHETIC Award of Contract for items to be procured"),
    "award",
  );
  assert.equal(
    noticeKind(
      "SYNTHETIC Notification for procurement of proprietary List of Items to be Procured",
    ),
    "procurement",
  );
  assert.equal(
    noticeKind("SYNTHETIC List of equipment to be purchased"),
    "procurement",
  );
  assert.equal(
    noticeKind("SYNTHETIC Tender for biomedical waste disposal service"),
    "procurement",
  );
  assert.equal(
    noticeKind("SYNTHETIC Tender for award-winning medical equipment"),
    "procurement",
  );
  assert.equal(
    noticeKind(
      "SYNTHETIC Procurement of equipment listed in previous purchase report",
    ),
    "procurement",
  );
  assert.equal(noticeKind("SYNTHETIC MRI machine"), "unknown");
  assert.ok(!NON_DEMAND_NOTICE_KINDS.some((k) => k === ("unknown" as string)));
});
test("Safdarjung preserves official links and explicitly complete GeM/CPPP references without treating generic Date as publication", () => {
  const p = parseListing(
    table(
      row("SYNTHETIC EOI for Equipment GEM-2025-B-123456") +
        row(
          "SYNTHETIC Tender 2026_VMMC_123456_1",
          "/sites/default/files/second.pdf",
        ),
    ),
    s,
  );
  assert.equal(p.notices[0].bidNumber, "GEM/2025/B/123456");
  assert.equal(p.notices[0].portal, "gem");
  assert.equal(p.notices[1].bidNumber, "2026_VMMC_123456_1");
  assert.ok(
    p.notices.every((n) => n.publishedAt === null && n.closingDate === null),
  );
  assert.equal(p.notices[0].documents.length, 2);
  assert.equal(p.next, null);
  assert.equal(pageAllowed(s.url + "?page=1", s), false);
  const external = parseListing(
    table(
      row(
        "SYNTHETIC Tender for equipment",
        "https://archive.example/original.pdf",
      ),
    ),
    s,
  ).notices[0];
  assert.ok(
    external.documents.includes("https://archive.example/original.pdf"),
  );
});
test("Safdarjung keeps missing originals and reused documents distinct, and unfamiliar layout/pagination fails visibly", () => {
  const p = parseListing(
    table(
      row("SYNTHETIC Patient monitors", "") +
        row("SYNTHETIC Syringe pumps", ""),
    ),
    s,
  );
  assert.equal(p.notices.length, 2);
  assert.ok(
    p.notices.every((n) => n.url === s.url && n.documents.length === 0),
  );
  const reused = parseListing(
    table(row("SYNTHETIC Patient monitors") + row("SYNTHETIC Syringe pumps")),
    s,
  );
  assert.equal(reused.notices.length, 2);
  assert.notEqual(reused.notices[0].key, reused.notices[1].key);
  for (const html of [
    table().replace("</tr></tbody>", "<td>EXTRA</td></tr></tbody>"),
    table() + '<nav class="pager"></nav>',
    table().replace("Download / डाउनलोड", "Unexpected"),
  ])
    assert.throws(() => parseListing(html, s), /changed|missing/);
});
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  a = new Analytics(db),
  f = filterSchema.parse({ medical: "true" });
before(async () => {
  await db.initialize();
  await db.runMigrations();
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.transaction((q) => new NoticeLifecycle1792419000000().up(q));
  await db.query(
    "TRUNCATE discovered_notice,tender,organization,collection_run,job,analytics_snapshot CASCADE",
  );
  await db.query(
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (html: string, id = s.id) =>
  new Collection(db, async () => html, 0).run(id);
test("all notice types stay searchable while only procurement/amendment/uncertain listings enter demand insights", async () => {
  const rows = examples
    .map(([t], i) => row(t, "/sites/default/files/" + i + ".pdf"))
    .join("");
  await collect(table(rows));
  const c = new Collection(db),
    all = await c.notices({ page: 1 });
  assert.equal(all.total, examples.length);
  const eligible = examples.filter(
    ([, k]) => !NON_DEMAND_NOTICE_KINDS.some((n) => n === (k as string)),
  ).length;
  assert.equal((await a.overview(filterSchema.parse({}))).tenders, eligible);
  assert.equal(
    (await c.summary()).counts.non_demand,
    examples.length - eligible,
  );
  for (const kind of NOTICE_KINDS) {
    const result = await c.notices({ page: 1, kind });
    assert.equal(result.total, examples.filter(([, k]) => k === kind).length);
    assert.ok(result.rows.every((n: any) => n.raw.kind === kind));
  }
  assert.ok(
    (await a.products(f)).every((p) =>
      Object.values(p.quantities || {}).every((v) => v === null),
    ),
  );
  assert.deepEqual(
    await a.states(filterSchema.parse({ medical: "true", basis: "delivery" })),
    [],
  );
});
test("an award or cancellation for the same GeM bid does not create new demand or erase its original request evidence", async () => {
  await collect(
    table(
      row(
        "SYNTHETIC GEM/2026/B/123456 Tender for patient monitors",
        "/original.pdf",
      ) +
        row(
          "SYNTHETIC GEM/2026/B/123456 Award of Contract for patient monitors",
          "/award.pdf",
        ) +
        row(
          "SYNTHETIC GEM/2026/B/123456 Cancellation of tender for patient monitors",
          "/cancel.pdf",
        ),
    ),
  );
  assert.equal((await a.overview(f)).tenders, 1);
  assert.equal((await new Collection(db).notices({ page: 1 })).total, 3);
});
test("native Safdarjung exact document/title pairs group across profiles while conflicting titles stay distinct", async () => {
  await collect(table());
  await collect(table(), "safdarjung-archive");
  assert.equal((await a.overview(f)).tenders, 1);
  await collect(
    table(row("SYNTHETIC Tender for syringe pumps")),
    "safdarjung-archive",
  );
  assert.equal((await a.overview(f)).tenders, 2);
});
test("derived lifecycle migration preserves source evidence, observation history, review decisions, ages and local pauses", async () => {
  await collect(table(row("SYNTHETIC Award of Contract for patient monitors")));
  await db.query(
    "UPDATE discovered_notice SET raw=raw-'kind',review_status='dismissed',first_seen='2020-01-01',last_seen='2020-01-02'",
  );
  await db.query("UPDATE source SET enabled=false WHERE id='safdarjung'");
  const before = await db.query(
      "SELECT id,title,source_url,documents,review_status,first_seen,last_seen FROM discovered_notice",
    ),
    observations = await db.query(
      "SELECT * FROM notice_observation ORDER BY id",
    );
  await db.transaction((q) => new NoticeLifecycle1792419000000().up(q));
  assert.deepEqual(
    await db.query(
      "SELECT id,title,source_url,documents,review_status,first_seen,last_seen FROM discovered_notice",
    ),
    before,
  );
  assert.deepEqual(
    await db.query("SELECT * FROM notice_observation ORDER BY id"),
    observations,
  );
  assert.equal(
    (await db.query("SELECT raw FROM discovered_notice"))[0].raw.kind,
    "award",
  );
  assert.equal(
    (await db.query("SELECT enabled FROM source WHERE id='safdarjung'"))[0]
      .enabled,
    false,
  );
});
test("legacy raw records without lifecycle metadata remain eligible until safe derived refresh", async () => {
  await collect(table());
  await db.query("UPDATE discovered_notice SET raw=raw-'kind'");
  assert.equal((await a.overview(f)).tenders, 1);
  assert.equal(
    (await new Collection(db).notices({ page: 1, kind: "unknown" })).total,
    1,
  );
});
test("an access error after prior evidence retains data and records visible source failure", async () => {
  await collect(table());
  await assert.rejects(
    () =>
      new Collection(
        db,
        async () => {
          throw Error("Source returned HTTP 503; no access bypass attempted");
        },
        0,
      ).run(s.id),
    /HTTP 503/,
  );
  assert.equal((await new Collection(db).notices({ page: 1 })).total, 1);
  assert.match(
    (await db.query("SELECT last_error FROM source WHERE id='safdarjung'"))[0]
      .last_error,
    /503/,
  );
});
test("North bulk collection includes both Safdarjung profiles and excludes southern regional sources", async () => {
  const old = process.env.COLLECTION_REGION;
  process.env.COLLECTION_REGION = "north";
  try {
    assert.equal(SOURCES.filter((s) => s.adapter).length, 51);
    assert.equal(SOURCES.length, 102);
    assert.equal((await new Collection(db).queue()).queued, 46);
    const ids = (await db.query("SELECT payload->>'sourceId' id FROM job")).map(
      (r: any) => r.id,
    );
    assert.ok(ids.includes("safdarjung") && ids.includes("safdarjung-archive"));
    assert.ok(!ids.includes("kmscl"));
  } finally {
    if (old == null) delete process.env.COLLECTION_REGION;
    else process.env.COLLECTION_REGION = old;
  }
});
