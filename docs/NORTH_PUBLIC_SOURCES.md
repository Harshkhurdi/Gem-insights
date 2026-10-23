# Raebareli, Gorakhpur and Uttarakhand collection

Latest update: [notice types and Safdarjung](NOTICE_TYPES.md) adds two profiles and separates non-demand records. The counts and validation below describe the preceding rollout.

This North-first update adds **11 automated profiles**, taking the registry to **49 automated public listings and 101 registered targets**. It adds **1,660 real listing observations**. North remains the active rollout; South expansion is on hold.

| Institution / list | Captured observations | Date treatment |
| --- | ---: | --- |
| AIIMS Raebareli current tenders | 8 | Explicit publication and closing fields |
| AIIMS Raebareli archived tenders | 468 | Explicit publication and closing fields |
| AIIMS Raebareli current quotations | 14 | Explicit publication and closing fields |
| AIIMS Raebareli archived quotations | 452 | Explicit publication and closing fields |
| AIIMS Raebareli PAC | 1 | Objection windows are not publication/closing dates |
| AIIMS Gorakhpur current tenders | 186 | Generic Start/End dates stay unverified |
| AIIMS Gorakhpur current quotations | 379 | Generic Start/End dates stay unverified |
| AIIMS Gorakhpur archived quotations | 20 | Generic Start/End dates stay unverified |
| AIIMS Gorakhpur PAC | 132 | Generic Start/End dates stay unverified |
| Uttarakhand Health current tenders | 0 | Publisher explicitly returned no matching notices |
| Uttarakhand Health archived tenders | 0 | Publisher explicitly returned no matching notices |
| **Total additions** | **1,660** | |

Counts describe captures on 22 October 2026, not permanently fixed source totals. Raebareli's two archives reached their published final pages, preserving the normal 25-page job budget and saved-checkpoint/head-refresh behavior. Their sidebar totals are not used as collected counts: the PAC sidebar reports 73 while the actual public list exposes one card. Gorakhpur renders its full table in HTML; browser table pagination does not hide additional HTTP pages. Explicitly empty health lists do not establish zero statewide demand, completeness or deleted tenders. Restoring the snapshot adds historical notice facts; run the collector locally to populate source health for empty lists.

## Identity and evidence handling

Raebareli stores the official reference separately from its description. Complete GeM IDs are normalized from that reference field and retain GeM identity. Numbers inside downloaded filenames are never fabricated bid references. Its extensionless `tender-file-download`, `quotation-file-download` and `pac-file-download` routes point to original documents. A sampled tender route returned PDF bytes; collection retains these links without downloading document content during listing scans. Extensionless routes remain review/download links; automatic structured extraction still requires a supported same-host GeM PDF URL or a separately uploaded original.

When a native Raebareli notice moves between current and archived lists, its official download route preserves one grouped insight record. Distinct download namespaces remain distinct. Gorakhpur demonstrably reuses some PDF paths across different titles/references, so title context protects conflicting rows. Exact GeM references continue grouping across profiles. A missing Gorakhpur heading can use a meaningful published original-link label; a generic “Download” label fails visibly rather than fabricating a title. Original and amendment attachments remain evidence links.

Raebareli accepts only a single positive `page` query on the exact category path. Pagination must advance; category/host changes, repeated parameters and unexpected active JavaScript links fail visibly. The publisher's explicitly disabled final Next control is recognized as the end of the list. Captured pages from an interrupted validation were replayed through the same collector with their actual capture timestamps, rather than rerequesting the archives or making them appear freshly observed.

## Medical classification

The update recognizes source-observed clinical descriptions including ophthalmology, gynaecology/gynecology, paediatric/pediatric care, pulmonology, MRI, parenteral nutrition and cholecalciferol. The narrow `usg machine` alias maps to the existing ultrasound family. The migration appends that alias while preserving customized names and other local aliases. Electrical work, wiring, connections/points and phase-power work near clinical equipment no longer become equipment-purchase product matches. They can remain provisional clinical support notices. Reviewed item records, quantities and manual corrections are not silently rewritten.

The baseline now has **16,656 observations**, grouped into **16,483 procurement records** including **8,959 provisional medical/clinical records across 122 matched equipment families**. Raw medical observations total 9,024. Of these, 1,029 come from the new profiles; broader vocabulary also recovers 108 clinical observations from the earlier dataset. Candidate labels and equipment-family matches remain provisional. Listing titles never establish requested quantities, values or confirmed delivery locations.

## Update an existing Mac installation

Stop the running app and pull main from the repository root. Keep `COLLECTION_REGION=north` in your existing `.env`; preserve your private database credentials and administrator key.

```sh
git pull --ff-only origin main
npm ci
docker compose up -d --wait postgres
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

Open http://localhost:3000. A bulk UI action or the worker scheduler now selects **40 northern profiles plus four national profiles**. Other regional profiles remain excluded in North mode; explicit single-source actions remain available. National feeds can contain notices outside North. Existing observations remain visible. Previously queued jobs are not cancelled by the region setting.

For a single-source refresh, for example:

```sh
npm run collect -- aiims-raebareli
npm run collect -- aiims-gorakhpur
npm run collect -- uttarakhand-health
```

## Remaining North gaps

PHSC Punjab's homepage returned HTTP 503 in this environment and remains disabled pending source validation. Safdarjung's public current/archive lists are reachable, but mix tenders, awards, disposal auctions and reports of already-procured equipment. It remains an assisted target until that lifecycle distinction can prevent misleading requested-demand insights. Gorakhpur's separate archived-tender page has neither a procurement table nor an explicit no-notices state; it remains disabled rather than being counted as a successful empty read. Its current tenders and quotation archive are separate working profiles.

The [North coverage matrix](NORTH_COLLECTION.md) still applies. Other northern hospitals, state portals and historical backfills remain incomplete. These profiles do not establish complete North or national coverage.

## Validation

All **298 automated tests pass**, including 16 new parser/database regressions. Production API/web builds, TypeScript, formatting and diff checks pass. Tests cover reference-field GeM IDs, original links, objection-date semantics, strict/end-of-list pagination, hidden sort dates, missing headings, reused paths, moving current/archive records, honest empty results, clinical/electrical distinctions, preserved local pauses/checkpoints/reviews/observation age/custom aliases, and the 44-profile North queue.

A full normal CLI import restored all 16,656 records, preserving source evidence and every observation timestamp. Reimporting the 1,660 new observations returned zero inserts/updates and 1,660 unchanged. Compiled API explorer/detail/overview checks passed for all new populated profiles; explicitly dated Raebareli records produce publication trends while Gorakhpur/PAC records do not invent them. Listing quantities and values remain unknown, confirmed-delivery results stay empty, and the two reviewed sample bids still contribute exactly 27 known units without increasing the 8,959-record medical total. Database validation uses temporary PGlite; native PostgreSQL concurrency and real-document extraction accuracy remain separate checks.

All **22 production-browser checks passed**, including refreshed main pages, Raebareli and Gorakhpur acquisition-source filters, explicit publication trends versus undated notices, source-linked details, CSV export, empty-source/reset behavior and seven mobile views. The authenticated UI bulk action queued exactly 44 North/national profiles, including the new sources, and no southern regional jobs. No browser, console or API errors were recorded. These checks run in the project validation environment, not the user's Mac localhost.
