import { MigrationInterface, QueryRunner } from "typeorm";
export class DocumentReview1792406000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE extraction_draft ADD COLUMN manual_classifications jsonb NOT NULL DEFAULT '{}'::jsonb",
    );
    await q.query(
      "INSERT INTO product(id,name,category_id,aliases) VALUES('hospital-beds','Hospital beds (type unspecified)','hospital-infrastructure','[\"hospital bed\",\"hospital beds\"]'::jsonb) ON CONFLICT DO NOTHING",
    );
  }
  async down() {
    throw new Error(
      "Review history is retained; use a verified backup instead of destructive rollback.",
    );
  }
}
