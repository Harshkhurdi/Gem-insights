import { MigrationInterface, QueryRunner } from "typeorm";
export class EvaluationAttempt1792408100000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      "ALTER TABLE extraction_observation ADD COLUMN attempt_id uuid REFERENCES document_attempt(id)",
    );
  }
  async down() {
    throw new Error(
      "Preserve evaluation provenance; restore a verified backup instead.",
    );
  }
}
