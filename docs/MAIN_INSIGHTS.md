# Collected notices in the main insights

Collection no longer waits for item approval before a notice appears in the main project. Overview, Medical Equipment, Product Intelligence, Geographic Intelligence, Buyer Intelligence, Demand Trends and Tender Explorer read the same combined observation layer. New collection results feed it automatically; the dashboard refreshes when collection timestamps change.

The default is **all collected evidence, medical/clinical signals**. **Procurement scope → All procurement notices** includes the other collected categories. **Data included → Reviewed item records** retains the original item-only analysis; **Listing signals** isolates title-based observations.

## What the numbers mean

- **Observed notices** count grouped procurement observations. Known GeM references and structured CPPP tender IDs group repeated originals/amendments across sources. Repeated document URLs group native records. Native references with different documents and listing rows without a reliable reference stay separate. Unknown references and unrecognized amendments can still overlap: this is not a guaranteed national unique-tender count.
- **Medical signals** include classified equipment title matches and broader clinical procurement, such as reagents or consumables. A title match is provisional and is not a verified item order.
- Product tables count title matches alongside reviewed item records. Multi-product notices can appear in several families. Unmapped clinical supplies remain visible in the explorer, location/buyer counts and the “Other clinical procurement” time series without creating a fictitious equipment family.
- Quantities and monetary values come only from actual imported/reviewed line items. A listing with “20 units” in its title does not automatically contribute 20 units. Listing-only totals stay unknown. Quantity charts show an explicit empty state when no extracted quantities exist.
- Buyer views include the known buyer or publishing institution recorded on the source. Internally generated stable IDs let users drill into those names; they do not create organization records or confirm real-world buyer identities. Unknown names stay unknown. Conflicting names/states in grouped observations are not silently resolved.
- Listing Last Date stays a date, without inventing a closing time or open/closed status. Start Date is not substituted for publication. Trends use the earliest explicitly recorded publication date in a listing group, or the reviewed record's publication date when available. Undated observations remain excluded from time series.
- Confirmed-delivery views still require source-supported confirmed destination records. A listing's publisher state never becomes a confirmed delivery location.

## Review now enriches evidence

“Item review outstanding” is a document/item-processing state, not a barrier to main-project visibility. No records are falsely marked approved. The read-only `insight_record` and `insight_line` database views leave collected notices, original item records, versions and decisions intact.

When an imported/reviewed record matches a known bid identity or a linked native notice, it replaces that listing signal in the combined views. Its equipment lines and known quantities are counted once. Source filters still match the original contributing listing sources. A cancelled reviewed bid cannot reappear as an unreviewed active listing. Dismissed discoveries stay excluded from the combined analysis.

Explorer rows carry **Listing · item data unverified** or **Reviewed item record** badges. Listing detail pages retain original source links, title matches, dates, attachments and the actual related observations in that group. The existing document extraction/review workflow is available to improve item data. It remains local with no external LLM.

## Updating an existing installation

```sh
npm ci
npm run build -w @gem/api
npm run migrate
# Only needed if the included discovery baseline has not been loaded:
npm run import:discoveries
npm run dev
```

Existing collected notices become visible as soon as the migration is applied. No bulk approval or duplicate import into the tender/item tables is required. For a production web build, `npm run build` now clears the generated `.next` output before rebuilding, preventing runtime route-cache HTML and asset references from an older build from surviving the update.

## Validation

The earlier 4,642-observation baseline produced **4,571 grouped records**, including **1,904 medical signals across 78 product families** before any item approval. Adding the two included reviewed Bathinda records produced 1,906 medical records; the known requested quantity remained 27 units. Listing-only quantities stayed unknown. These counts describe that earlier snapshot, not India's total market. The current expanded snapshot and validation are documented in [Rajasthan/UP collection](STATE_MEDICAL_COLLECTION.md).

All **187 automated tests passed** in fresh temporary PGlite runtimes (109 + 78), including seven new combined-insight cases and HTTP integration checks. Tests cover immediate visibility, identity grouping, source aliases, reviewed-record precedence, cancellation, unknown quantities, native shared references, stable buyer filtering, confirmed-delivery exclusions, clinical supplies and dismissals. The production build, TypeScript checks and formatting checks passed. All 25 browser checks passed against the compiled API and production Next UI: populated main pages, buyer drilldown, listing details, CSV export, evidence/scope/location filters, reviewed quantities, seven mobile views and a real KMSCL collection worker run. No browser, console or API errors were recorded. Fresh server HTML included the new controls after a clean production build. Native PostgreSQL concurrency remains a separate local verification step; nationwide completeness and real-document extraction accuracy remain unmeasured.
