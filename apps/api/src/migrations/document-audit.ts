import { MigrationInterface, QueryRunner } from "typeorm";
export class DocumentAudit1792407000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE extraction_observation(id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES upload_document(id),parser_version text NOT NULL,record jsonb NOT NULL,evidence jsonb NOT NULL,observed_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX extraction_observation_document_idx ON extraction_observation(document_id,observed_at);`,
    );
  }
  async down() {
    throw new Error(
      "Original extraction observations are append-only; restore a backup instead.",
    );
  }
}
