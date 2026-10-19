import { MigrationInterface, QueryRunner } from "typeorm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { taxonomy, slug } from "../../../../packages/core/taxonomy";
export class Initial1792400000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      readFileSync(join(process.cwd(), "apps/api/src/schema.sql"), "utf8"),
    );
    await q.query(
      "INSERT INTO category VALUES ('procurement',NULL,'Government Procurement',true),('medical','procurement','Medical Equipment',true)",
    );
    for (const n of [
      "IT Equipment",
      "Electrical Equipment",
      "Construction Materials",
      "Industrial Machinery",
      "Furniture",
      "Other Categories",
    ])
      await q.query("INSERT INTO category VALUES ($1,$2,$3,false)", [
        slug(n),
        "procurement",
        n,
      ]);
    for (const [name, products] of Object.entries(taxonomy)) {
      await q.query("INSERT INTO category VALUES ($1,$2,$3,true)", [
        slug(name),
        "medical",
        name,
      ]);
      for (const [id, label, aliases] of products)
        await q.query("INSERT INTO product VALUES ($1,$2,$3,$4)", [
          id,
          label,
          slug(name),
          JSON.stringify(aliases),
        ]);
    }
  }
  async down() {
    throw new Error(
      "Destructive rollback disabled: restore a verified backup instead.",
    );
  }
}
