# Medical institution coverage

The local collector now has **15 working public listing profiles** and 60 registered source targets. The included discovery baseline has **4,642 real listing records**, up from 2,305. Records can overlap across current/archive pages and portals; they are not a count of unique bids, purchases or equipment units. All 36 state/UT targets remain registered, with incomplete actual collection coverage.

## Added public profiles

| Profile | Official listing | Observed records | Scope |
|---|---|---:|---|
| AIIMS Rishikesh current | https://aiimsrishikesh.edu.in/a1_1/?page_id=2525 | 196 | Mixed equipment, supplies, services and works |
| AIIMS Rishikesh archive | https://aiimsrishikesh.edu.in/a1_1/?page_id=2529 | 2,000 | Historical records, including original and related amendment links |
| AIIMS Rishikesh quotations | https://aiimsrishikesh.edu.in/a1_1/?page_id=2533 | 4 | Published quotation rows; current rows need not be medical |
| Kerala Medical Services Corporation notices | https://kmscl.kerala.gov.in/KMSCL/index.php/ckmscl/menucontentview/60 | 137 | Equipment notices, amendments, evaluation/price-opening and running-contract notices; not all are open tenders |

The four profiles added 2,337 listing records during a live collection check on 21 October 2026. Reaching the end of one published page does not prove that all historical or national tenders have been collected. The prior eleven profiles and local GeM extraction workflow are described in [national collection expansion](NATIONAL_COLLECTION_EXPANSION.md).

## Evidence and document handling

- Rishikesh's **Start Date** is not treated as verified publication. The displayed Last Date is stored as a date, without inventing a time or applying an unverified amendment date. Review linked extensions and originals.
- KMSCL's notice cards do not provide consistently structured references or dates. Those fields stay unknown. A price-opening summary or running-contract list stays a notice with its original title; it is not turned into an open bid or an order.
- Word, Excel and ZIP attachments are preserved as review links alongside PDFs. Published Rishikesh amendment pointers, including external document viewers, are retained. Listing scans do not download these files.
- The PDF extraction control is shown only for HTTPS links ending in `.pdf`; the server also enforces its existing exact official-host restriction. Word/Excel/ZIP files, external viewers and HTTP-only originals still require manual source review/import. No unsupported native-format extraction is claimed.
- A Rishikesh row with a missing/broken original link remains in discovery with the official listing as its source. Its reference and title distinguish it from other such rows, including during snapshot restore. Nested amendment tables are retained as related documents rather than parsed as additional tenders.
- Pagination for Rishikesh must retain the same WordPress `page_id`; navigation to another content page cannot silently count as a continuation.

## Medical recall and upgrades

Candidate detection now includes ELISA kits, reagents, medicines, catheters, sutures, tubes and additional clinical specialties. These broad candidates do not create equipment-family assignments or demand quantities by themselves. Original line items must still be reviewed. Equipment taxonomy remains 106 families.

The additive migration enables the new source adapters, preserves existing collector pauses, and resets a source checkpoint only when its configured listing URL changes. It refreshes derived candidate labels using the database taxonomy while preserving notice IDs, review decisions, and original first/last observation times. The next unchanged scan continues to respect the existing decision. Changes to actual source contents or attachments can still require re-review.

Update the application normally, run migrations, then optionally load the expanded baseline:

```sh
npm ci
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

Existing data and reviewed tender analytics are retained. Collection and extraction use local processing with no external LLM. Scheduling requires the PC and worker to remain running.

## Current access gaps

Collector requests to JIPMER (including its advertised alternate domains), ESIC, TNMSC, AIIMS Bhopal and PGIMER returned errors in this environment. BFUHS's advertised tender path also failed. AIIMS Patna returned a redirect/challenge page. They have not been enabled as working collectors. These observations describe access from this environment, not permanent site outages. No challenge or access control was bypassed. KMSCL's separate equipment/drug tender pages returned empty content without an explicit empty-list declaration, so they are not marked as successful collectors; the populated notices page is implemented instead.

## Validation

- **180 automated tests passed** in two serial groups using fresh temporary databases (102 + 78). New regression cases cover Rishikesh references, dates, nested amendment tables, missing originals, stable restore identities, external amendment pointers, WordPress pagination scope, KMSCL notices/layout failures and medical-supply recall.
- The migration test preserved an existing decision, observation age and paused source checkpoint, enabled the newly implemented adapter, and kept the decision on an unchanged subsequent scan. It added zero verified tenders.
- API/web production builds, TypeScript checks, formatting and whitespace checks passed.
- Production browser checks passed for sign-in, discovery/review controls, queueing and a 390-pixel viewport with no horizontal overflow or browser exceptions. A synthetic Excel BOQ stayed visible as a link and received no PDF extraction control.
- Live collection passed for all four added profiles over four pages, adding 2,337 observations. The expanded snapshot restored 4,642 records, restored twice more without duplicates, preserved all 4,642 observation timestamps and a newer local record, and added zero verified tenders.

Database validation here uses PGlite; native PostgreSQL 16+ concurrency still requires local verification. Real-document extraction accuracy has not been measured.
