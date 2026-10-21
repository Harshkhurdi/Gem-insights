> Later update: [institution coverage](INSTITUTION_COVERAGE.md) adds AIIMS Rishikesh and KMSCL, bringing the current totals to 15 profiles and 4,642 listing records. The 11-profile counts below describe the preceding increment.

# National collection expansion

This increment expands the medical-tender collection workflow, preserves more source notices, and connects discovered GeM documents to local extraction. It remains a local-PC application with no external LLM.

## Working public sources

The registry has 57 targets, including all 36 state/UT procurement targets. **Eleven public listing profiles are implemented**, compared with three previously:

| Source | Coverage |
|---|---|
| CPPP central active tenders | Existing central listing; partial paginated discovery |
| CPPP state active tenders | New state-portal mirror; state is read explicitly and is not mistaken for the buyer name |
| AIIMS Raipur tenders | Existing tender listing |
| AIIMS Raipur quotations | New quotation list and linked documents |
| ICMR | Existing institute tender listing |
| AIIMS Bilaspur GeM | New institution-hosted GeM notices and PDFs |
| AIIMS Bilaspur CPPP | New native-reference institution notices |
| AIIMS Bilaspur NIQ | New quotation notices |
| HLL Lifecare | New public tender list with its published path-based pagination |
| GMCH Chandigarh current tenders | New structured list; explicit empty state handled honestly |
| GMCH Chandigarh proprietary/quotation notices | New document-link listing restricted to main content |

These profiles do not establish complete national or historical coverage. They include mixed equipment, consumable, service and civil-work notices. CPPP's state mirror can contain thousands of pages. No CAPTCHA, authenticated session, private API or access challenge is bypassed. AIIMS Delhi, Bathinda's postback-based categories and other unavailable/unimplemented sources remain unfinished.

## Collection improvements

- Distinct documents can share a file/tender reference. Discoveries now preserve those documents separately; a shared reference no longer silently drops another notice. Verified demand continues to use reviewed portal/reference identity. Reconcile shared references and complete amendments before approving them.
- An additive migration preserves existing notice IDs and review state while moving old keys to the new scheme. Existing paused collectors stay paused; newly implemented adapters become enabled. Source checkpoints are reset only if that source's listing URL changed.
- A continuing 25-page job refreshes up to three recent pages before resuming its older-page checkpoint. Head refresh does not rewind the backfill cursor. A reserved page allows backfill progress. No complete-history claim is made.
- Published pagination is constrained to verified listing paths. Unsupported or cyclic Next links fail visibly instead of silently claiming the list has ended.
- Interactive PDF extraction/import jobs take priority over background listing scans. The worker remains a single durable process.
- Clinical discovery terms include unfamiliar specialty equipment; the taxonomy adds a separate cone-beam CT family (106 families total). Quantities are never derived from title mentions or candidate counts.

## Extract a linked GeM document

1. Update normally: `npm ci`, `npm run build -w @gem/api`, `npm run migrate`, `npm run dev`.
2. Sign in through Administration and open Tender Collection.
3. Review a GeM-identified notice and click **Extract PDF locally** beside its original or amendment link.
4. The worker downloads only that selected, same-host HTTPS PDF from the recorded official source. Redirects, credentials, query redirects and unlinked URLs are refused. Downloads have a 30-second timeout and 15 MiB limit.
5. Existing local PDF processing extracts text and structured fields. It uses no external AI. Originals are temporary by default; reviewed evidence follows the existing retention workflow.
6. Click **Refresh extraction status**, inspect warnings and the draft, then **Use extracted draft for review** for a new tender. Review all original pages and amendments, fix identities, and approve a complete snapshot.

An existing reviewed tender is not replaced automatically by a partial extraction. Compare and reconcile its complete current record. If the PDF identifies another bid, loading it into the current notice is refused. Failed/OCR-needed documents can be reprocessed; repeated queued/processed requests reuse the existing document.

Native non-GeM PDFs/BOQs still need manual source review or import. Global GeM tenders may use `GlobalTenderCategory` instead of a product description. Parser `gem-pdf-3` ignores that placeholder as an equipment line, handles the separate wrapped Global Tender Title and spaced bilingual Dated label, and leaves absent quantities unknown. A readable PDF is not proof that its BOQ has been extracted completely.

## Included snapshot

The updated compressed snapshot contains **2,305 real listing discoveries**: the original 1,909 plus 396 new observations from the source expansion. Eight new profiles were checked over 13 pages; one current GMCH list explicitly had no notices. Original/corrigendum and cross-source records can overlap. Broad candidate labels are provisional and change with taxonomy rules.

`npm run import:discoveries` loads the snapshot into discovery review, adding no verified equipment quantities. Per-record observation times preserve the older baseline's age. Import skips newer local observations and is idempotent. It does not reset source schedules or live checkpoints.

## Validation and limits

Validation on 21 October 2026:

- All **169 automated tests passed**, run as two serial groups with fresh temporary PostgreSQL-compatible runtimes (101 + 68). These cover the new source layouts, dates, pagination, reference collisions, recent-page refresh/backfill, local PDF queue/draft flow, stale identities, document host restrictions and extraction route authorization/origin checks, alongside existing analytics and ingestion behavior.
- API and web production builds, TypeScript checks, formatting and whitespace checks passed.
- A production browser smoke check passed for administrator sign-in, collection/review/extraction controls and queueing, with no browser exceptions. A 390-pixel viewport had no horizontal overflow. Fixtures were synthetic.
- Snapshot restore inserted 2,305 discoveries, repeated without duplicates, preserved all 2,305 observation timestamps and a newer local observation, and added zero verified tenders. Upgrade checks preserved existing notice IDs, review decisions and collector pause settings.
- Eight new profiles were exercised against public listings over 13 pages. One real eight-page global GeM PDF from AIIMS Bilaspur was inspected locally: its separate equipment title and publication date were extracted, while absent item quantities stayed unknown. This is a targeted check, not a measured extraction accuracy result.

Database checks in this execution environment use temporary PGlite PostgreSQL runtimes; native PostgreSQL 16+ concurrency still needs local verification. Source access remains partial; original quantities, buyer identities, dates and amendments require review. Neither stored notices nor title candidates are completed purchases or complete all-India medical demand.
