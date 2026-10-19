# Architecture and metric contracts

A separate Next.js App Router / TypeScript / Material UI application communicates with a NestJS REST service. TanStack Query owns server data and cache invalidation. React state owns view filters; Redux is intentionally unnecessary for this initial scope. PostgreSQL is the source of truth. TypeORM manages connection pooling, transactions and versioned migrations; analytical SQL executes in the database rather than aggregating the dataset in browser memory.

## Services

- `apps/web`: responsive dashboard, catalog, rankings, geography, buyers, history, tender source drill-downs, CSV export and authenticated administration.
- `apps/api`: validated query/body schemas, read APIs, HMAC cookie sessions, imports, corrections, taxonomy/rules and OpenAPI metadata.
- Separate `worker`: durable PostgreSQL queue, `FOR UPDATE SKIP LOCKED`, persistent attempts/backoff, source checkpoints and database snapshots. A dedicated advisory lock prevents overlapping workers. Import transactions have a separate lock. PostgreSQL supplies the queue to avoid operating Redis for this bounded initial release; the worker can later move to BullMQ without changing the tender schema.
- `packages/core`: deterministic classification, canonical hashing, exact allocation checks, input contracts, taxonomy seeds and CSV handling. No LLM or paid AI service is called.

## Normalized storage

| Table | Purpose |
|---|---|
| source | Access mode, coverage, checkpoint and last successful update |
| collection_run | Import/feed provenance, successes, changes, unchanged records, failures |
| tender | Unique GeM bid, latest complete observation, dates, explicit estimate and buyer FK |
| tender_version | Append-only raw observations and hashes, linked to collection runs |
| organization | Explicit institution source key and buyer location; no fuzzy identity merging |
| line_item | Stable external item key, original product text, quantities/units, evidence and confidence |
| destination | Multiple per-line destinations, confirmation flag and explicit quantity allocations |
| document | Original source links, optional content hashes and labels |
| category, product | Database taxonomy and literal-phrase aliases |
| correction | Audit trail keyed by tender plus stable external line key; survives reimports |
| job | Durable queued imports/sync/reclassification, bounded retry and error state |
| analytics_snapshot | Dataset observation snapshots after successful worker jobs |

Amounts use `numeric`, dates are `date` or timezone-aware timestamps. The UI renders IST. Indexes cover product/tender joins, publication dates, institutions, confirmed state/district destinations, source versions and pending jobs. `synchronize` is disabled. Imports are complete-record replacements, transactional across the batch; failed validation cannot partially increase demand. Unchanged hashes update only `last_checked`. Different observations append versions; distinct re-tenders remain separate with an explicit relationship. An older explicit source revision cannot replace a newer one.

## Metric contracts

1. Unique tenders = `COUNT(DISTINCT tender_id)`. Categories/products may overlap; their counts must not be summed to infer the overall total.
2. Product quantity = sum of known line quantities grouped by normalized product and unit. `pieces`, `nos` and `each` normalize to `units`; `sets`, `kits` and other units remain separate. Unknown quantities remain null. Partial known totals display missing-line counts. No all-equipment aggregate quantity score is computed.
3. Known tender value = sum of one explicit value per distinct tender, including two distinct tenders with the same value. Product value = explicit line values only. A tender-level estimate is never apportioned across products or destinations. EMD is separate; no price or award is inferred.
4. Buyer location groups by institution address. Delivery state views use confirmed destinations and sum only their stated allocations. A line with 100 units, 60 Punjab / 40 Haryana, contributes 60 and 40, not 100 twice. Unallocated quantities are not spread equally or placed at the buyer's address. Distinct state appearances can exceed the national distinct tender count.
5. Newly announced demand and historical intervals use publication dates. Unknown publication dates are counted in quality indicators and excluded from dated series. Missing periods are not filled with zero demand.
6. Growth uses two equal inclusive calendar-date windows; a zero baseline or fewer than five notices in either period suppresses the percentage. All comparisons say observed dataset; no coverage-comparable or national-growth claim is made. Financial years run April–March.
7. Cancelled notices remain stored but are excluded by default. Filters can explicitly inspect them. Closing dates and unknown/closed statuses are not award evidence.
8. Classification only uses the requested line description, not incidental product names appearing in a PDF search-results list or the buyer's hospital name. Ambiguous multi-product descriptions go to review. Civil works, services, maintenance, consumables and accessories are excluded. Manual corrections take precedence over subsequent rule evaluation.

## Security and deployment boundary

Administrative mutations require a signed HTTP-only SameSite=Strict cookie plus an exact allowed Origin. Keys must contain at least 24 characters. Login attempts are rate limited. No admin key is stored in browser localStorage. API requests are size limited; queries use bound parameters. CSV exports neutralize spreadsheet formulas. The feed destination is operator environment configuration, not a user-supplied fetch URL, and redirects are rejected. Environment files, databases and logs are ignored by Git.

Read APIs are suitable for a single research workspace; put the whole deployment behind organizational access control if the imported data is private. This initial release has one administrator role, not a multi-tenant authorization system. Use a same-origin Next proxy for cookie sessions. Long-running workers need a persistent Node host; they do not run in Vercel serverless functions.
