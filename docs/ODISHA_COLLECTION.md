# Odisha medical tender collection

This update adds AIIMS Bhubaneswar's current and archive lists to the main project. There are now **25 automatic public-listing profiles** and **68 registered targets**. Coverage remains partial; registered state portals are not proof of collection across India.

| Profile | Official listing | Collected observations |
|---|---|---:|
| AIIMS Bhubaneswar current tenders | https://aiimsbhubaneswar.nic.in/tenders/ | 482 |
| AIIMS Bhubaneswar archive | https://aiimsbhubaneswar.nic.in/tenders-archive/ | 1,383 |

Both pages were collected through the normal HTTP collector on 22 October 2026, adding **1,865 observations**, including **1,087 provisional medical/clinical signals**. All published rows are present in the HTML; this adapter does not guess pagination or call an unpublished endpoint.

## Evidence and limitations

- Explicit **Publishing Date** and **Closing Date** values are validated and retained. Dates are never inferred from a document's upload directory or filename. Invalid or absent dates stay unknown. Dates are source claims and can contain publisher errors; originals and amendments still require review.
- The **Download** column establishes the original source link. **Corrigendum**, **Cancellation** and **Award of Contract** documents remain attached as evidence. Adding an amendment does not replace the original identity. These observations are not all active bids, purchases or awarded contracts. The collector does not infer lifecycle status from the presence of an attachment.
- Three historical rows link to original documents but have no source title. They remain available with the explicit label **Untitled procurement notice (source title missing)**, without a guessed clinical classification or equipment family.
- Where an original is missing, the official listing remains the source reference and title-based keys distinguish its rows. Amendment-only evidence does not invent an original. Known GeM/CPPP references keep the existing grouping; identical native original-document URLs group across current/archive profiles. Unknown amendments, changed document URLs and missing-original notices can still overlap.
- Numbers in a title, such as “12 Nos.”, remain title text. A filename such as `GeM-Bidding-9980442.pdf` does not establish a complete GeM bid number. These fields do not become verified quantities or bid identities. Linked native-format documents still require review; automatic structured processing supports GeM-format PDFs with an established portal identity.
- Odisha is the institution's recorded publisher state. It is not a confirmed delivery location. The two sources share the publisher identity **AIIMS Bhubaneswar**. Mixed civil work and unrelated procurement remain available under the all-procurement filter.
- Unsupported query parameters, changed table columns, access failures and unsupported pagination fail visibly. A source error is not recorded as an empty successful collection.

## Run the update locally

```sh
git pull --ff-only origin main
npm ci
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

Open http://localhost:3000. The restored notices appear immediately in the main insights; review enriches item-level quantities and values. The baseline now contains **11,538 real observations**. With listing evidence alone, it produces **11,430 grouped procurement records**, including **6,067 medical signals across 96 matched equipment families**. These are observations of requested procurement, including historical and amendment evidence, rather than a verified national market size.

The additive migration preserves existing source pauses, unrelated checkpoints and stored notices. It enables a newly implemented profile and clears its checkpoint only if the listing URL changes. Both sources can be managed under **Tender Collection** or run directly:

```sh
npm run collect -- aiims-bhubaneswar
npm run collect -- aiims-bhubaneswar-archive
```

## Validation

The new coverage has **11 regression tests** covering original and later-document identity, missing source titles, missing originals, duplicate rows, explicit and invalid dates, unknown quantities, same-document grouping, main insights, review preservation and migration safety. The focused regression run passes **148 tests**, including existing collection, analytics, HTTP and source-coverage checks. Production API/web builds, TypeScript and formatting checks pass.

Live collection added all 1,865 new observations through the normal collector. Previously collected baseline metadata was bulk-seeded into the temporary combined validation database. Compiled API checks verified overview, explorer/detail and trends for the new sources; all listing quantities and values remained unknown, and confirmed-delivery geography remained empty. Adding the two existing reviewed samples preserved 6,067 medical records and exactly 27 known requested units.

A separate cold database restored the entire 11,538-record snapshot through the normal import CLI, preserved every observation timestamp and reproduced the grouped totals above without creating verified tender records. Database checks use PGlite; native PostgreSQL concurrency and real-document extraction accuracy remain separate checks. This update changes collectors and source data; it does not claim a new browser-layout validation.

Latest update: [medical classification](MEDICAL_CLASSIFICATION.md) refreshes the same 11,538 observations to 6,355 grouped medical/clinical records across 117 matched equipment families. The counts above describe the Odisha rollout before that classification update.
