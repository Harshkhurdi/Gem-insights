import { MigrationInterface, QueryRunner } from "typeorm";
import { taxonomy, slug } from "../../../../packages/core/taxonomy";
import { refreshNoticeClassifications } from "../collection/classification";
const addedFamilies = new Set([
  "patient-warming",
  "fluid-warmers",
  "pulse-oximeters",
  "resuscitation-kits",
  "blood-pressure-monitors",
  "laryngoscopes",
  "surgical-retractors",
  "surgical-tourniquets",
  "nucleic-acid-extraction",
  "gene-sequencers",
  "osmometers",
  "electrophoresis",
  "retinoscopes",
  "pachymeters",
  "nerve-monitors",
  "bilirubinometers",
  "dermatomes",
  "manometry",
  "apheresis",
  "autopsy-saws",
  "autopsy-tables",
]);
const addedAliases: Record<string, string[]> = {
  "patient-monitors": ["multi para monitor"],
  "x-ray": [
    "digital radiography system",
    "computed radiography system",
    "digital panoramic x ray unit",
    "mobile digital radiography",
    "x ray unit",
  ],
  pcr: ["digital pcr system", "pcr system"],
  eeg: ["video eeg", "eeg system"],
  oct: ["anterior segment oct", "oct based imaging system"],
  histopathology: ["micro tome"],
  arthroscopy: ["arthroscopysystem"],
  "radiant-warmers": ["baby infant warmer"],
};
export class MedicalRecall1792416000000 implements MigrationInterface {
  async up(q: Pick<QueryRunner, "query">) {
    for (const [category, products] of Object.entries(taxonomy)) {
      await q.query(
        "INSERT INTO category(id,parent_id,name,active) VALUES($1,'medical',$2,true) ON CONFLICT DO NOTHING",
        [slug(category), category],
      );
      for (const [id, name, aliases] of products) {
        if (!addedFamilies.has(id) && !addedAliases[id]) continue;
        await q.query(
          `INSERT INTO product(id,name,category_id,aliases) VALUES($1,$2,$3,$4)
          ON CONFLICT(id) DO UPDATE SET aliases=product.aliases ||
            coalesce((SELECT jsonb_agg(a.value) FROM jsonb_array_elements($5::jsonb) a(value)
              WHERE NOT product.aliases @> jsonb_build_array(a.value)), '[]'::jsonb)`,
          [
            id,
            name,
            slug(category),
            JSON.stringify(aliases),
            JSON.stringify(addedAliases[id] || aliases),
          ],
        );
      }
    }
    await refreshNoticeClassifications(q);
  }
  async down() {
    throw new Error(
      "Restore a verified backup rather than destructive rollback",
    );
  }
}
