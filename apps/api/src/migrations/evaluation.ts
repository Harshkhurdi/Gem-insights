import { MigrationInterface, QueryRunner } from "typeorm";
export class Evaluation1792408000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
ALTER TABLE document_batch ADD COLUMN max_files integer NOT NULL DEFAULT 20 CHECK(max_files BETWEEN 1 AND 500), ADD COLUMN max_bytes bigint NOT NULL DEFAULT 104857600;
ALTER TABLE upload_document DROP CONSTRAINT upload_document_status_check;
ALTER TABLE upload_document ADD CONSTRAINT upload_document_status_check CHECK(status IN ('queued','extracting','review','needs_ocr','failed','deferred','rejected','approved','cancelled'));
ALTER TABLE extraction_draft ADD COLUMN approval_ready boolean NOT NULL DEFAULT false, ADD COLUMN expected_tender_hash text;
ALTER TABLE extraction_review ADD COLUMN classifications jsonb NOT NULL DEFAULT '{}';
ALTER TABLE extraction_observation ADD COLUMN classifications jsonb, ADD COLUMN processing_ms integer, ADD COLUMN page_methods jsonb;
CREATE TABLE document_attempt(id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES upload_document(id),started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,status text NOT NULL DEFAULT 'running',processing_ms integer,error text);
CREATE TABLE evaluation_case(document_id uuid PRIMARY KEY REFERENCES upload_document(id),observation_id uuid REFERENCES extraction_observation(id),attempt_id uuid REFERENCES document_attempt(id),real_original boolean NOT NULL,original_reviewed boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),version integer NOT NULL DEFAULT 1,tags jsonb NOT NULL DEFAULT '[]',record jsonb NOT NULL,classifications jsonb NOT NULL DEFAULT '{}',line_matches jsonb NOT NULL DEFAULT '{}',error_causes jsonb NOT NULL DEFAULT '[]',reason text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz);
CREATE TABLE evaluation_annotation(id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES evaluation_case(document_id),version integer NOT NULL,action text NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(document_id,version));
CREATE TABLE evaluation_run(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),report jsonb NOT NULL);
CREATE INDEX document_attempt_document_idx ON document_attempt(document_id,started_at DESC);
CREATE INDEX batch_document_document_idx ON batch_document(document_id);
CREATE INDEX evaluation_case_status_idx ON evaluation_case(status,real_original);
CREATE INDEX job_pdf_document_idx ON job((payload->>'documentId')) WHERE kind='pdf';
CREATE UNIQUE INDEX job_pdf_active_idx ON job((payload->>'documentId')) WHERE kind='pdf' AND status IN ('pending','running');
CREATE INDEX tender_source_idx ON tender(source_id,published_at);
`);
    const additions: Record<string, string[]> = {
      "patient-monitors": [
        "multi parameter monitor",
        "multiparameter patient monitor",
        "bedside multiparameter monitor",
        "multipara monitor",
        "रोगी मॉनिटर",
      ],
      "icu-ventilators": ["आईसीयू वेंटिलेटर"],
      ultrasound: ["ultrasound imaging system"],
    };
    for (const [id, aliases] of Object.entries(additions))
      await q.query(
        "UPDATE product SET aliases=(SELECT jsonb_agg(DISTINCT a) FROM jsonb_array_elements_text(aliases || $2::jsonb) a) WHERE id=$1",
        [id, JSON.stringify(aliases)],
      );
  }
  async down() {
    throw new Error(
      "Evaluation audit history is retained; restore a verified backup instead.",
    );
  }
}
