import { MigrationInterface, QueryRunner } from "typeorm";
export class Documents1792405000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
CREATE TABLE document_batch(id uuid PRIMARY KEY,provenance text NOT NULL,source_name text NOT NULL,permission_notes text NOT NULL,authorized_processing boolean NOT NULL CHECK(authorized_processing),retain_content boolean NOT NULL,retain_evidence boolean NOT NULL CHECK(retain_evidence),allow_ocr boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE upload_document(id uuid PRIMARY KEY,sha256 text UNIQUE NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),filename text NOT NULL,byte_size integer NOT NULL CHECK(byte_size>0),source_url text,source_name text NOT NULL,provenance text NOT NULL,permission_notes text NOT NULL,retain_content boolean NOT NULL,retain_evidence boolean NOT NULL,allow_ocr boolean NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','extracting','review','needs_ocr','failed','deferred','rejected','approved')),pages integer,extraction_method text,error text,content_present boolean NOT NULL DEFAULT true,purge_after timestamptz NOT NULL DEFAULT now()+interval '24 hours',extracted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,tender_id uuid REFERENCES tender(id),import_run_id uuid REFERENCES collection_run(id));
CREATE TABLE batch_document(batch_id uuid NOT NULL REFERENCES document_batch(id),document_id uuid NOT NULL REFERENCES upload_document(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(batch_id,document_id));
CREATE TABLE document_page(document_id uuid NOT NULL REFERENCES upload_document(id),page_number integer NOT NULL,method text NOT NULL,text_content text,character_count integer NOT NULL,readable boolean NOT NULL,PRIMARY KEY(document_id,page_number));
CREATE TABLE extraction_draft(document_id uuid PRIMARY KEY REFERENCES upload_document(id),version integer NOT NULL DEFAULT 1,record jsonb NOT NULL,evidence jsonb NOT NULL,classifications jsonb NOT NULL,warnings jsonb NOT NULL,parser_version text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE extraction_review(id uuid PRIMARY KEY,document_id uuid NOT NULL REFERENCES upload_document(id),action text NOT NULL,reason text NOT NULL,actor text NOT NULL DEFAULT 'administrator',draft_version integer NOT NULL,record jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX upload_document_queue_idx ON upload_document(status,created_at);
ALTER TABLE line_item ADD COLUMN specifications text;
`);
    // Extend existing medical aliases without replacing operator-maintained rules.
    const additions: Record<string, string[]> = {
      "patient-monitors": [
        "bedside monitor",
        "patient monitoring system",
        "multipara patient monitor",
      ],
      "icu-ventilators": ["icu ventilators v2", "critical care ventilator"],
      anaesthesia: [
        "anaesthesia workstations",
        "anesthesia workstation system",
      ],
      "syringe-pumps": ["syringe infusion pump"],
      "infusion-pumps": ["volumetric infusion pump"],
      "icu-beds": ["intensive care bed"],
      "electric-beds": ["electrical hospital bed"],
      hematology: ["haematology analyzer", "automated hematology analyzer"],
      biochemistry: ["clinical chemistry analyzer"],
      endoscopy: ["video endoscopy system"],
    };
    for (const [id, aliases] of Object.entries(additions))
      await q.query(
        "UPDATE product SET aliases=(SELECT jsonb_agg(DISTINCT a) FROM jsonb_array_elements_text(aliases || $2::jsonb) a) WHERE id=$1",
        [id, JSON.stringify(aliases)],
      );
  }
  async down() {
    throw new Error(
      "Document records are auditable; restore a backup instead of destructive rollback.",
    );
  }
}
