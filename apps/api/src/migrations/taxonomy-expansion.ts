import { MigrationInterface, QueryRunner } from "typeorm";
import { taxonomy, slug } from "../../../../packages/core/taxonomy";
export class TaxonomyExpansion1792409100000 implements MigrationInterface {
  async up(q: QueryRunner) {
    for (const [name, products] of Object.entries(taxonomy)) {
      await q.query(
        "INSERT INTO category(id,parent_id,name,active) VALUES($1,'medical',$2,true) ON CONFLICT DO NOTHING",
        [slug(name), name],
      );
      for (const [id, label, aliases] of products)
        await q.query(
          "INSERT INTO product(id,name,category_id,aliases) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [id, label, slug(name), JSON.stringify(aliases)],
        );
    }
  }
  async down() {
    throw new Error(
      "Restore a verified backup instead of destructive rollback",
    );
  }
}
