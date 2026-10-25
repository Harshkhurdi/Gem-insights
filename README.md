# GeM Intelligence

A **new independent project** for understanding requested government procurement: which equipment, where, which institutions and how observations change over time. It does not modify the existing tender tracker or MedOps.

Implemented with Next.js App Router, TypeScript, Material UI, TanStack Query, NestJS, TypeORM and PostgreSQL. It has a separate durable worker and a database-backed taxonomy. It uses no external LLM or paid AI API.

**Public-listing collection now supports 72 profiles and 123 registered targets.** The Northeast rollout begins with Meghalaya HFW; see [Northeast collection](docs/NORTHEAST_COLLECTION.md). The East rollout began with WBMSCL's 7,167-row tender archive; see [East collection](docs/EAST_COLLECTION.md). The West rollout begins with GMSCL Gujarat; see [West collection](docs/WEST_COLLECTION.md). The South India rollout added TNMSC archives, AIIMS Mangalagiri, AIIMS Bibinagar and JIPMER; see [South collection](docs/SOUTH_COLLECTION.md). The Central India rollout added AIIMS Bhopal and CGMSCL equipment tenders; see [Central collection](docs/CENTRAL_COLLECTION.md). The North source-recovery update added AIIMS Jodhpur, SGPGIMS Lucknow, PHSC Punjab and HMSCL Haryana; see [northern source recovery](docs/NORTH_SOURCE_RECOVERY.md). Collected notices now appear immediately in the **main insights**, with medical/clinical signals selected by default. Review enriches item quantities and values; it no longer blocks visibility. See [main insight definitions and upgrade steps](docs/MAIN_INSIGHTS.md). Open **Tender Collection** to manage sources and item processing. The registry tracks targets across all 36 states/UTs; the implemented profiles remain partial coverage. See [Raebareli/Gorakhpur expansion](docs/NORTH_PUBLIC_SOURCES.md) for the earlier sources and [North-first collection and remaining priorities](docs/NORTH_COLLECTION.md), [Odisha collection](docs/ODISHA_COLLECTION.md), [Rajasthan/UP collection](docs/STATE_MEDICAL_COLLECTION.md), [Delhi/Bathinda collection](docs/AIIMS_COLLECTION.md) and [institution coverage](docs/INSTITUTION_COVERAGE.md) for earlier rollouts and [linked GeM PDF extraction](docs/NATIONAL_COLLECTION_EXPANSION.md). The nationwide rollout order is tracked in [the India expansion roadmap](docs/INDIA_EXPANSION_ROADMAP.md). See [local collection guide](docs/LOCAL_COLLECTION.md).

**Medical classification now recognizes 128 equipment families**, including patient warming, laryngoscopes and previously missed radiography variants. Alias reclassification also updates collected notices. See [classification improvements and count definitions](docs/MEDICAL_CLASSIFICATION.md). The included baseline has **16,656 observations → 16,483 grouped procurement records → 8,959 provisional medical/clinical records**; 122 equipment families have matched listing evidence.

**Live GeM scraping is disabled.** Public pages were reachable, but authorized bulk access and reproduction rights were not verified. Authorized CSV/JSON imports are the working ingestion path. See [source research](SOURCE_RESEARCH.md).

## Run locally

Requirements: Node 22.13+ and PostgreSQL 16+ (any local install works — for example Homebrew's `brew install postgresql@18 && brew services start postgresql@18`). **Docker is not required.**

```sh
npm ci
cp .env.example .env
```

Set `DATABASE_URL`, `TEST_DATABASE_URL`, `WEB_ORIGIN`, and a random `ADMIN_KEY` of at least 24 characters in `.env`. Do not commit secrets. To generate a key: `openssl rand -hex 32`.

Then bootstrap everything — databases, migrations and the optional historical baseline — with one idempotent command:

```sh
npm run setup
npm run import:verified
# Optional: load the real collected listing observations into main insights
npm run import:discoveries
```

Run the whole application with a single command:

```sh
npm run dev
```

Open **http://localhost:3000**. `dev` starts the API, the separate worker and Next.js. It compiles the API once; restart after backend edits. The API binds to loopback by default. A separately managed worker can run with `npm run worker`. Stopping the browser does not stop scheduled/background work. A service failure or Ctrl+C stops the local app process groups together. For this rollout, keep `COLLECTION_REGION=north` in `.env`; existing installations must add it explicitly. See [North-first update steps](docs/NORTH_COLLECTION.md).

`import:verified` is optional: it loads **two real original GeM notices from AIIMS Bathinda, 27 ventilators requested, one buyer**, with source links and short evidence. No tender data is automatically fabricated. Without imports the dashboard has honest empty states. Known prices stay unknown. Delivery locations in these two records are inferred, so the confirmed-delivery view is intentionally empty. These records are not representative of the national market.

## User workflows

- Product Intelligence separates unique tenders, equipment quantity by unit, buyers, buyer states and known explicit line estimates. Sorting and filters execute in SQL.
- Geographic Intelligence uses a licensed map containing all 36 states/UTs, a full accessible state table and comparisons of up to four states. Select a state, then inspect institutions, districts and source tenders. Buyer and confirmed delivery location are distinct views.
- Demand Trends compares up to five products using publication day/week/month/quarter/financial year, with separate tender and quantity views. Guarded equal-period comparisons never invent zero-baseline growth.
- Tender Explorer filters and paginates unique bids. Details retain original descriptions, classified items, evidence, source documents, destination confidence, source versions and manual corrections.
- Administration accepts authorized CSV/JSON datasets, queues worker imports, reviews ambiguous classifications, edits aliases, adds categories/products, runs reclassification and retries failed jobs.
- Data Coverage shows source status, run history, missing fields and last successful updates.
- CSV exports include filters, timestamp, source and metric definitions. Tender export is explicitly **the current filtered page** (25 records); aggregate exports include returned aggregate rows.

## Import contract

Upload an array of complete tender objects or `{ "records": [...], "provenance": "..." }`. See `data/verified-bids.json` for a real small example. Required identity fields are an original tender reference (`bidNumber`, with optional `sourcePortal` defaulting to `gem`), title, HTTP(S) source URL, an explicit institution key/name and one or more line items with stable keys, original names and source evidence. Publication date may be null; known publication dates use `YYYY-MM-DD`. Closing/revision timestamps require an explicit timezone. Quantities and INR monetary values can be decimal strings; null means unknown. Destination records require a state, confirmation flag and evidence; allocations can be null. Never divide an unknown destination allocation by assumption.

Each batch is a **complete current snapshot per bid**, not a patch of selected line items. Use the same stable line key after amendments so corrections survive. Duplicate bids inside one batch are rejected. Repeating an identical bid is idempotent. All rows in a batch commit or roll back together. CSV uses one row per line item and groups repeated bid metadata; duplicate line keys are rejected.

CSV headers (`data/import-template.csv`):

```text
bidNumber,title,sourceUrl,publishedAt,closesAt,status,buyerKey,buyerName,buyerState,buyerDistrict,estimatedValue,itemKey,itemName,quantity,unit,lineEstimatedValue,itemEvidence,destinations
```

The `destinations` cell is an optional quoted JSON array. Do not include an estimated price unless the source explicitly supplies it. Authorized PDFs can now be uploaded and extracted locally through Administration, reviewed, then approved through the same importer. CSV/JSON remains available. See [PDF workflow and OCR prerequisites](docs/PDF_WORKFLOW.md).

### Authorized feed adapter

Only enable after the operator has source authorization. Set `AUTHORIZED_FEED_URL=https://...`, `FEED_AUTHORIZED=true`, optionally `SYNC_INTERVAL_MS` (minimum five minutes) and `FEED_PAGE_DELAY_MS` (minimum one second). The endpoint must return:

```json
{"records": [], "nextCursor": null}
```

Each page contains at most 1,000 complete bids / 5 MB. Cursors must advance. Checkpoints persist after successful pages; requests time out after 30 seconds. Redirects are refused, no session credentials are copied, retries are bounded and a 100-page job budget prevents unbounded collection. Feed imports remain labeled partial: a feed claiming completeness is not accepted as proof. This adapter has not been validated against a real authorized GeM feed.

## PDF document processing

Administration now supports authorized PDF batches, local embedded text extraction, optional local OCR, page evidence, structured review and atomic approval/import. Content retention requires a separate permission. Apply `npm run migrate` after updating. The API and worker share a private `DOCUMENT_STORAGE_DIR`. See [PDF workflow](docs/PDF_WORKFLOW.md), [corpus status](data/golden-corpus.json), and the [GeM access request draft](docs/GEM_DATA_ACCESS_REQUEST.md). Collection downloads linked GeM PDFs only when the operator requests extraction; listing scans do not fetch document contents.

`npm run documents:evaluate` (or the compatible `documents:accuracy`) evaluates independently approved corpus annotations against pinned extraction observations. It reports per-field precision/recall/F1, normalized exact match, missing/correction rates, explicit item matching, classification errors and processing samples/timing. Synthetic cases never establish real accuracy. Administration now supports a separate 50-document corpus checklist, side-by-side original review, individually staged batch approval and batches up to 500 PDFs / 2 GiB. See [Phase 3 workflow and metric definitions](docs/PHASE3_EVALUATION.md). Real-document accuracy remains **Not yet measured**: no authorized original corpus was supplied.

## Validation

```sh
npm run build
npm run typecheck
npm test
npm run format:check
```

Tests use a dedicated PostgreSQL database whose name ends in `_test`; the suite refuses a production URL. Test fixtures exist only inside tests and are marked synthetic. Integration tests cover unique counting, duplicates, amendments, corrections, civil-work exclusions, unknown prices, buyer/delivery separation, allocated/unknown units, publication dates, financial years, transactional failures, re-tenders, pagination, origin/session protection and worker retry state. Map tests verify identities, bounds and winding. Tests run serially across files to keep the isolated integration database consistent.

## Deploy

1. Provision managed PostgreSQL with verified TLS; create a dedicated least-privilege application user. Set `DATABASE_SSL=true` if required by the provider. Back up the database before future migrations.
2. Build and run migrations from the repository root: `npm ci && npm run build -w @gem/api && npm run migrate`.
3. Start persistent API: `NODE_ENV=production npm run start:api`. Set `API_HOST=0.0.0.0` only behind the intended host/reverse proxy and its access controls; no database port needs public access.
4. Start separate persistent worker: `npm run worker`, with the same database and feed configuration. PostgreSQL advisory locking prevents overlapping workers.
5. Deploy `apps/web` to Vercel (npm workspace monorepo), with `API_URL` pointing to the API origin at build time. Keep `/api/*` routed through Next for same-origin HTTP-only cookies. Set API `WEB_ORIGIN` to the exact frontend HTTPS origin. Private imported data should sit behind organization-wide access controls on the whole app.
6. Verify `/api/health`, import a small authorized dataset, inspect the worker/job status and compare totals to its source before larger ingestion. No deployment account or production data provider was supplied; this repository is prepared for deployment rather than pretending to have national live ingestion.

## Documentation and current limits

[Architecture and metric definitions](ARCHITECTURE.md) · [Source research and coverage](SOURCE_RESEARCH.md) · [Known limitations](docs/LIMITATIONS.md)

Current intended use is a single research workspace with reviewed source imports. This is an initial working release, not a completed national market dataset or a proven high-scale production deployment. Source observations are restated using the latest imported revision; raw historical versions remain auditable.
