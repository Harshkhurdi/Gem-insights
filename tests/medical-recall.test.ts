import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { DataSource } from "typeorm";
import { classify, digest } from "../packages/core/domain";
import { taxonomy } from "../packages/core/taxonomy";
import { noticeClassification } from "../apps/api/src/collection/parsers";
import { Collection } from "../apps/api/src/collection/service";
import { migrations } from "../apps/api/src/migrations";
import { refreshNoticeClassifications } from "../apps/api/src/collection/classification";
import { MedicalRecall1792416000000 } from "../apps/api/src/migrations/medical-recall";
import { Analytics, filterSchema } from "../apps/api/src/analytics";
import { Ingestion } from "../apps/api/src/ingestion";
import { raipur } from "./collection-fixtures";
const rules = Object.values(taxonomy)
  .flat()
  .map(([id, name, aliases]) => ({ id, name, aliases, category_id: "" }));
const examples = [
  ["Conductive Patient Warming System", "patient-warming"],
  ["Advanced in line blood and IV Fluid Warmer", "fluid-warmers"],
  ["Hand Held Pulse Oxymeters", "pulse-oximeters"],
  ["ADULT RESUSCITATION KIT", "resuscitation-kits"],
  ["Ambulatory Blood Pressure Monitor", "blood-pressure-monitors"],
  ["Video Laryngoscope", "laryngoscopes"],
  [
    "Multipurpose Table Mounted Abdominal Retractor System",
    "surgical-retractors",
  ],
  ["Portable Electronic Tourniquet", "surgical-tourniquets"],
  ["Automated nucleic acid extraction machine", "nucleic-acid-extraction"],
  ["Nanopore-Based DNA And RNA Sequencing System", "gene-sequencers"],
  ["Osmometer", "osmometers"],
  ["Horizontal Electrophoresis System", "electrophoresis"],
  ["Streak Retinoscope", "retinoscopes"],
  ["Hand Held Pachymeter", "pachymeters"],
  ["Facial Nerve Monitor", "nerve-monitors"],
  ["Transcutaneous bilirubinometer", "bilirubinometers"],
  ["Powered Dermatome", "dermatomes"],
  ["High Resolution Manometry System-Solid State", "manometry"],
  ["Apheresis Machine", "apheresis"],
  ["Oscillating Electric Autopsy Saw", "autopsy-saws"],
  ["Autopsy Table", "autopsy-tables"],
];
for (const [title, id] of examples)
  test(`previously missed clinical equipment: ${title}`, () => {
    const n = noticeClassification("SYNTHETIC Supply of " + title);
    assert.equal(n.medical, true);
    assert.deepEqual(n.products, [id]);
    assert.equal(classify(title, rules).productId, id);
  });
test("source-observed variants map to existing families without quantity claims", () => {
  for (const [title, id] of [
    ["Mobile Digital Radiography System", "x-ray"],
    ["Computed Radiography System", "x-ray"],
    ["Digital Panoramic X-Ray Unit", "x-ray"],
    ["Digital PCR System", "pcr"],
    ["32 Channel Video EEG", "eeg"],
    ["Anterior Segment OCT", "oct"],
    ["semi motorized rotary Micro-tome", "histopathology"],
    ["HIP Arthroscopysystem", "arthroscopy"],
    ["Baby infant Warmer", "radiant-warmers"],
  ]) {
    const n = noticeClassification("SYNTHETIC " + title);
    assert.equal(n.medical, true);
    assert.ok(n.products.includes(id));
    assert.equal("quantity" in n, false);
  }
});
test("maintenance, spares and consumables remain clinical signals without becoming equipment demand", () => {
  for (const title of [
    "AMC of Patient Warming System",
    "Accessories for Video Laryngoscope",
    "Pulse Oxymeter probes",
    "Reagents for DNA Capillary Sequencer",
    "Repair of Osmometer",
    "Construction of room for Apheresis Machine",
  ]) {
    const n = noticeClassification("SYNTHETIC " + title);
    assert.equal(n.medical, true, title);
    assert.deepEqual(n.products, [], title);
    assert.equal(classify(title, rules).productId, null, title);
  }
});
test("clinical supply and research terms remain unclassified signals rather than equipment families", () => {
  for (const title of [
    "Supply of Inj. Tenecteplase 40mg ampules",
    "Sterilization Containers for CSSD",
    "NGS Sequencing Kit",
    "Nucleic Acid Isolation kit",
    "RNA Sequencing Services",
    "Autopsy Instruments",
  ]) {
    const n = noticeClassification("SYNTHETIC " + title);
    assert.equal(n.medical, true, title);
    assert.deepEqual(n.products, [], title);
  }
});
test("ordinary institutional work, generic amendments and unrelated warmers/monitors are not swept into medical scope", () => {
  for (const title of [
    "Construction of boundary wall at AIIMS Bhubaneswar",
    "Supply of LED Display for IT Cell",
    "Computer monitor",
    "Water cooler maintenance",
    "Food warmer for staff canteen",
    "Office order NIB 285",
    "Untitled procurement notice (source title missing)",
  ]) {
    const n = noticeClassification("SYNTHETIC " + title);
    assert.equal(n.medical, false, title);
    assert.deepEqual(n.products, [], title);
  }
});
test("listing product labels and hashes are stable when database rule order changes", () => {
  const title = "SYNTHETIC Patient warming system and Video Laryngoscope";
  const forward = noticeClassification(title, rules);
  const reverse = noticeClassification(title, [...rules].reverse());
  assert.deepEqual(forward, reverse);
  assert.equal(digest(forward), digest(reverse));
});
test("longer equipment aliases still take precedence and ambiguous lines require review", () => {
  assert.equal(classify("ICU ventilator", rules).productId, "icu-ventilators");
  assert.equal(
    classify("Video laryngoscope and patient warming system", rules).productId,
    null,
  );
  assert.equal(
    classify("Video laryngoscope and patient warming system", rules).review,
    true,
  );
});
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new DataSource({ type: "postgres", url, migrations }),
  a = new Analytics(db);
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
    "UPDATE source SET enabled=(adapter IS NOT NULL),checkpoint=NULL",
  );
});
const collect = (title: string) =>
  new Collection(db, async () => raipur(title), 0).run("aiims-raipur");
test("migration refresh recovers existing listings while preserving review decisions, timestamps, evidence and observation history", async () => {
  await collect("SYNTHETIC Supply of patient warming system");
  const [n] = await db.query("SELECT * FROM discovered_notice"),
    raw = {
      ...n.raw,
      medical: false,
      products: [],
      reason: "SYNTHETIC legacy classification",
    };
  await db.query(
    "UPDATE discovered_notice SET raw=$2,current_hash=$3,medical_candidate=false,products='[]',review_status='dismissed',review_reason='SYNTHETIC operator decision',last_seen='2026-10-19T00:00:00Z' WHERE id=$1",
    [n.id, JSON.stringify(raw), digest(raw)],
  );
  const before = await db.query("SELECT * FROM notice_observation ORDER BY id");
  await db.transaction((q) => new MedicalRecall1792416000000().up(q));
  const [updated] = await db.query("SELECT * FROM discovered_notice");
  assert.equal(updated.medical_candidate, true);
  assert.deepEqual(updated.products, ["patient-warming"]);
  assert.equal(updated.review_status, "dismissed");
  assert.equal(updated.review_reason, "SYNTHETIC operator decision");
  assert.equal(
    new Date(updated.last_seen).toISOString(),
    "2026-10-19T00:00:00.000Z",
  );
  assert.equal(updated.source_url, n.source_url);
  assert.deepEqual(updated.documents, n.documents);
  assert.deepEqual(
    await db.query("SELECT * FROM notice_observation ORDER BY id"),
    before,
  );
  assert.equal(updated.current_hash, digest(updated.raw));
  assert.equal(
    (await a.overview(filterSchema.parse({ medical: "true" }))).tenders,
    0,
  );
  await collect("SYNTHETIC Supply of patient warming system");
  assert.equal(
    (await db.query("SELECT review_status FROM discovered_notice"))[0]
      .review_status,
    "dismissed",
  );
});
test("new matches appear in main product/trend/geography insights without creating reviewed items or quantities", async () => {
  await collect("SYNTHETIC Supply of patient warming system");
  const f = filterSchema.parse({ medical: "true" });
  assert.equal((await a.overview(f)).tenders, 1);
  assert.equal((await a.products(f))[0].product_id, "patient-warming");
  assert.equal((await a.products(f))[0].quantities.unknown, null);
  assert.equal((await a.trends(f))[0].product_id, "patient-warming");
  assert.equal((await a.states(f))[0].state, "Chhattisgarh");
  assert.deepEqual(
    await a.states(filterSchema.parse({ medical: "true", basis: "delivery" })),
    [],
  );
  assert.equal((await db.query("SELECT count(*)::int n FROM tender"))[0].n, 0);
});
test("migration appends only new aliases and preserves customized labels, categories and removals", async () => {
  const [old] = await db.query(
    "SELECT * FROM product WHERE id='patient-monitors'",
  );
  try {
    await db.query(
      "UPDATE product SET name='SYNTHETIC custom label',aliases='[\"SYNTHETIC CUSTOM\"]' WHERE id='patient-monitors'",
    );
    await db.transaction((q) => new MedicalRecall1792416000000().up(q));
    await db.transaction((q) => new MedicalRecall1792416000000().up(q));
    const [p] = await db.query(
      "SELECT * FROM product WHERE id='patient-monitors'",
    );
    assert.equal(p.name, "SYNTHETIC custom label");
    assert.equal(p.category_id, old.category_id);
    assert.deepEqual(p.aliases, ["SYNTHETIC CUSTOM", "multi para monitor"]);
  } finally {
    await db.query(
      "UPDATE product SET name=$1,aliases=$2 WHERE id='patient-monitors'",
      [old.name, JSON.stringify(old.aliases)],
    );
  }
});
test("listing refresh does not silently reclassify reviewed lines or overwrite manual corrections", async () => {
  await new Ingestion(db).import(
    [
      {
        bidNumber: "GEM/2026/B/555555",
        title: "SYNTHETIC reviewed",
        sourceUrl: "https://example.org/synthetic.pdf",
        buyer: { key: "SYNTHETIC", name: "SYNTHETIC" },
        items: [
          {
            key: "one",
            name: "SYNTHETIC Patient Warming System",
            quantity: "2",
            unit: "pieces",
            evidence: "SYNTHETIC page 1",
          },
        ],
      },
    ],
    "SYNTHETIC evidence",
  );
  const [line] = await db.query("SELECT * FROM line_item");
  await new Ingestion(db).correct(
    line.id,
    "infusion-pumps",
    "SYNTHETIC operator-reviewed correction",
  );
  const before = await db.query("SELECT * FROM line_item");
  await db.transaction((q) => new MedicalRecall1792416000000().up(q));
  assert.deepEqual(await db.query("SELECT * FROM line_item"), before);
});

test("derived refresh cannot overwrite a newer collector version that arrives during classification", async () => {
  await collect("SYNTHETIC Supply of Patient Warming System");
  const [notice] = await db.query("SELECT * FROM discovered_notice");
  const old = {
    ...notice.raw,
    medical: false,
    products: [],
    reason: "SYNTHETIC old label",
  };
  await db.query(
    "UPDATE discovered_notice SET raw=$2,current_hash=$3,medical_candidate=false,products='[]' WHERE id=$1",
    [notice.id, JSON.stringify(old), digest(old)],
  );
  const latest = {
    ...notice.raw,
    title: "SYNTHETIC Construction of boundary wall",
    ...noticeClassification("SYNTHETIC Construction of boundary wall"),
  };
  await refreshNoticeClassifications({
    query: async (sql: string, params?: any[]) => {
      const rows = await db.query(sql, params);
      if (sql.startsWith("SELECT id,source_id,raw,current_hash"))
        await db.query(
          "UPDATE discovered_notice SET title=$2,raw=$3,current_hash=$4,medical_candidate=false,products='[]' WHERE id=$1",
          [notice.id, latest.title, JSON.stringify(latest), digest(latest)],
        );
      return rows;
    },
  });
  const [updated] = await db.query("SELECT * FROM discovered_notice");
  assert.deepEqual(updated.raw, latest);
  assert.equal(updated.current_hash, digest(latest));
  assert.equal(updated.medical_candidate, false);
});
