import { MigrationInterface, QueryRunner } from "typeorm";
import { SOURCES } from "../collection/registry";
export class Collection1792409000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
      ALTER TABLE tender ADD COLUMN source_portal text NOT NULL DEFAULT 'gem';
      ALTER TABLE tender DROP CONSTRAINT tender_bid_number_key;
      ALTER TABLE tender ADD CONSTRAINT tender_portal_bid_key UNIQUE(source_portal,bid_number);
      ALTER TABLE source ADD COLUMN listing_url text;
      ALTER TABLE source ADD COLUMN portal text NOT NULL DEFAULT 'gem';
      ALTER TABLE source ADD COLUMN states jsonb NOT NULL DEFAULT '[]';
      ALTER TABLE source ADD COLUMN adapter text;
      ALTER TABLE source ADD COLUMN enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE source ADD COLUMN interval_minutes integer NOT NULL DEFAULT 360 CHECK(interval_minutes>=15);
      ALTER TABLE source ADD COLUMN next_collection_at timestamptz NOT NULL DEFAULT now();
      ALTER TABLE source ADD COLUMN last_attempt timestamptz;
      ALTER TABLE source ADD COLUMN last_error text;
      CREATE TABLE discovered_notice(
        id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES source(id), external_key text NOT NULL,
        bid_number text, source_portal text NOT NULL, title text NOT NULL, source_url text NOT NULL,
        documents jsonb NOT NULL DEFAULT '[]', published_at date, closing_date date, buyer_name text, buyer_state text,
        medical_candidate boolean NOT NULL, products jsonb NOT NULL DEFAULT '[]', classification_reason text NOT NULL,
        review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','dismissed')),
        review_reason text, reviewed_at timestamptz, tender_id uuid REFERENCES tender(id) ON DELETE SET NULL,
        current_hash text NOT NULL, raw jsonb NOT NULL, first_seen timestamptz NOT NULL DEFAULT now(),
        last_seen timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,external_key)
      );
      CREATE TABLE notice_observation(
        id uuid PRIMARY KEY, notice_id uuid NOT NULL REFERENCES discovered_notice(id) ON DELETE CASCADE,
        run_id uuid NOT NULL REFERENCES collection_run(id) ON DELETE CASCADE, hash text NOT NULL, raw jsonb NOT NULL,
        observed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(notice_id,hash)
      );
      CREATE INDEX notice_search_idx ON discovered_notice(source_id,medical_candidate,review_status);
      CREATE INDEX notice_date_idx ON discovered_notice(published_at DESC NULLS LAST);
      CREATE UNIQUE INDEX one_collection_per_source ON job((payload->>'sourceId')) WHERE kind='collect' AND status IN ('pending','running');
    `);
    for (const s of SOURCES) {
      await q.query(
        `INSERT INTO source(id,name,mode,coverage,access_notes,listing_url,portal,states,adapter,enabled)
        VALUES($1,$2,$3,'partial',$4,$5,$6,$7,$8,$9)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,mode=EXCLUDED.mode,access_notes=EXCLUDED.access_notes,listing_url=EXCLUDED.listing_url,portal=EXCLUDED.portal,states=EXCLUDED.states,adapter=EXCLUDED.adapter`,
        [
          s.id,
          s.name,
          s.adapter ? "public-listing" : "assisted",
          s.scope,
          s.url,
          s.portal,
          JSON.stringify(s.states),
          s.adapter,
          !!s.adapter,
        ],
      );
    }
  }
  async down() {
    throw new Error(
      "Restore a verified backup instead of destructive rollback",
    );
  }
}
