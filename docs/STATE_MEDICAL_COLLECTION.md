# Rajasthan and Uttar Pradesh medical collection

The application now supports **23 automatic public-listing profiles** and **66 registered source targets**. This update adds Rajasthan Medical Services Corporation's equipment/instrument and drug/surgical lists, plus the Uttar Pradesh University of Medical Sciences tender page. Records contribute to the main insights immediately. These are public procurement observations, including historical notices, rather than a verified national tender or purchase count.

## Public profiles

| Profile | Official page | Observations in the validation snapshot |
|---|---|---:|
| RMSC equipment/instruments | https://rmsc.health.rajasthan.gov.in/content/raj/medical/rajasthan-medical-services-corporation-ltd-/en/Tenders/Equipment-Instrument-Tenders.html | 2,572 |
| RMSC drug/surgical notices | https://rmsc.health.rajasthan.gov.in/content/raj/medical/rajasthan-medical-services-corporation-ltd-/en/Tenders/Drug-Tenders.html | 1,355 |
| UPUMS | https://www.upums.ac.in/tender | 77 |

Live validation on 22 October 2026 read all three published HTML pages successfully, adding **4,004 observations**. The expanded baseline contains **9,673 observations**, compared with 5,669 previously. RMSC's tables contain their published records in the HTML even though browser scripts paginate their display. The parser reads the complete table. Blank separator rows do not become notices. UPUMS published an identical title/document/date row twice; it is retained once.

## Evidence and metric definitions

- RMSC's **Name** and **Description** are stored together as the listing title so a short notice name retains its published equipment context. Original detail articles and PDF/Word/Excel/ZIP attachments remain available for source review. An evaluation, responsive-bidder list, office order or corrigendum remains a notice with its original wording; it is not converted into an open bid, order or confirmed sale.
- RMSC's generic **From**, **To** and **Upload Date** fields do not establish the original bid publication or submission deadline. Bulk-upload timestamps can postdate the original tender by years. These records therefore keep unknown publication and closing dates and do not introduce artificial publication-trend spikes. The original source page remains the review reference.
- UPUMS has an explicit **Published Date**, which is validated and retained. Closing times and equipment quantities remain unknown unless separately reviewed/imported from original evidence.
- A clinical keyword match in the name/description remains provisional. Additionally, a notice explicitly listed in RMSC's **Drug Tenders** category is a clinical-category signal even when its title only says “Corrigendum”. Its reason identifies this source-category evidence. The equipment page has no blanket clinical-category override: unfamiliar or nonclinical notices remain available through the all-procurement filter.
- Category evidence does not create equipment-family assignments, quantities or prices. The same source context is used during collection, snapshot restore and derived-label refresh, preventing a generic drug notice from losing its clinical label or resetting an operator's review decision on an unchanged scan.
- Known GeM and CPPP references retain their existing cross-source grouping. A short or yearless NIB number in a title is not turned into a fabricated complete bid identity. Native notices with different article links remain separate unless another reliable identity is available; unrecognized amendments can still overlap.
- Rajasthan and Uttar Pradesh are the recorded publisher states for these institutions. They do not become confirmed delivery locations. The collection creates zero verified item records.

Missing documents remain explicit: where the original is absent, a real attachment or the official listing is retained as the source. Separate missing-document titles receive stable distinct keys. Pagination cannot silently change category or add unsupported query parameters. A missing/unrecognized layout fails visibly rather than being recorded as an empty success.

## Update locally

```sh
git pull --ff-only origin main
npm ci
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

No reset is required. The additive migration preserves existing source pauses and unrelated checkpoints and clears a checkpoint only when its listing URL changes. Use **Tender Collection** to run or pause the three new profiles. The medical/clinical view includes provisional category signals; **All procurement notices** exposes unclassified records for further review.

## Validation and remaining gaps

**137 focused tests passed**, including 13 new parser, database and snapshot-CLI cases. They cover source-category evidence, original attachments, missing-document identities, duplicate rows, ambiguous dates, current collector counts, migration safety, unchanged review decisions, reviewed-record precedence and unknown quantities. Production API/web builds, TypeScript checks and formatting checks passed. Compiled API checks passed against all three live-collected sources and the combined snapshot: **9,565 grouped records**, including **4,980 medical signals across 92 product families**. Adding the two reviewed sample bids retained 4,980 medical records and exactly 27 known requested units. Quantities from listing-only records stayed unknown.

The previous baseline was bulk-loaded into the temporary validation database to check combined analytics; the 4,004 new observations went through the normal live collector. A separate cold database restored the complete 9,673-record snapshot through the normal CLI, preserved all 9,673 observation timestamps and reproduced the 9,565 grouped records, 4,980 medical signals and 92 matched product families. All 1,355 drug-category observations retained their clinical labels after import; no verified tenders were created. No new browser-layout behavior was introduced; the overview wording now describes listing signals to cover both title and source-category evidence.

UPMSCL's equipment listing returned HTTP 503 in this environment and has not been enabled as a working collector. This is an observed access gap, not a claim that the service is permanently unavailable. Nationwide coverage and historical archives remain incomplete. Database validation here uses PGlite; native PostgreSQL concurrency and real-document extraction accuracy remain separate checks.
