# Recovering missed medical tender signals

This update improves classification of already-collected notices. It does not add a new source or claim a new collection run. The baseline remains **11,538 observations** from **25 automatic public-listing profiles**. Its source URLs, original titles, document links, bid references, publication/closing dates and observation timestamps are preserved.

## What changed

The equipment vocabulary adds **21 families**, bringing the built-in taxonomy to **127 families**. An existing legacy generic hospital-bed family remains in databases created by earlier migrations. New families include patient/blood/fluid warming, pulse oximeters, resuscitation kits, blood-pressure monitors, laryngoscopes, retractor systems, electronic tourniquets, nucleic-acid extraction systems, gene sequencers, osmometers, electrophoresis systems, retinoscopes, pachymeters, nerve monitors, bilirubinometers, dermatomes, manometry systems, apheresis machines and autopsy equipment.

Existing families recognize missing source-observed variants such as **digital/computed radiography**, **digital PCR**, **video EEG**, **anterior-segment OCT**, **micro-tome** and **multi para monitor**. Phrase boundaries and the existing longer-phrase precedence remain in place. A computer monitor or food warmer does not become medical equipment merely because a hospital published its tender.

Clinical visibility is separate from equipment demand. Maintenance, spares and consumable notices that name recognized equipment remain provisional medical/clinical signals while retaining no equipment purchase assignment. Specific clinical supply/research wording, including injection abbreviations, sterilization containers and nucleic-acid/NGS supplies, can add a clinical signal without creating a product family or quantity. These signals still require original-document review; they are not confirmed purchases.

## Counts

| Metric | Refreshed baseline |
|---|---:|
| Collected observations | 11,538 |
| All grouped procurement records | 11,430 |
| Raw observations with medical/clinical signals | 6,411 |
| Grouped medical/clinical records | 6,355 |
| Matched equipment families | 117 |

The stored snapshot gains **293 medical/clinical observation labels** compared with its previous stored raw labels. Grouped totals differ from observation counts because known bid references and identical source documents can overlap. These are classification changes on existing records, rather than newly collected tenders. A normal import of the previous baseline already refreshed three stale labels using older migration-added aliases. Against that runnable prior version, this update adds 290 medical/clinical observations and **288 grouped medical records** (6,067 → 6,355). The medical view remains provisional and can still contain broad matches or miss unfamiliar descriptions.

## Upgrade and operator workflow

```sh
git pull --ff-only origin main
npm ci
npm run build -w @gem/api
npm run migrate
# Optional on a new database: restore the included observations
npm run import:discoveries
npm run dev
```

The additive migration appends the new vocabulary and refreshes existing listing labels. It preserves custom product names, category assignments and aliases; existing-family updates append only this rollout's new aliases, without reinstating unrelated aliases an operator removed. It preserves notice review status/reason, observation dates and source observation history. Reviewed item lines and manual corrections are not silently changed by this migration.

Under **Administration → Taxonomy and classification rules**, save aliases and select **Reclassify items and collected notices**. The existing worker job now refreshes both reviewed item classifications and collected listing labels; previously it refreshed item lines only. Manual line corrections remain protected. The worker must be running. A derived refresh only writes a notice if its source hash still matches the version it read, so it cannot overwrite a newer collector update. Product IDs are sorted before hashing to prevent rule-order changes from resetting an unchanged notice's review decision.

## Validation

All **257 tests pass**, including the full parser, document/PDF workflow, database, analytics, HTTP and worker suite. New regressions cover missed equipment, clinical maintenance/supplies without equipment quantities, unrelated institutional work, deterministic hashes, preserved reviews/customizations/evidence, and a collector update arriving during reclassification. The HTTP check exercises the actual reclassification job through the compiled API and worker after an alias edit.

Production API/web builds, TypeScript checks and formatting checks pass. A full-baseline upgrade check compares all 11,538 records before and after the actual migration, preserving source evidence and observation dates. Compiled API checks verify the updated overview, equipment filters and source-linked explorer details. Listing-only quantities/prices remain unknown, and confirmed delivery locations remain empty. The two existing reviewed samples still add exactly **27 known requested units** without duplicating matching listing records.

A separate cold database restores the refreshed snapshot through the normal CLI and reproduces the grouped counts above while preserving every observation timestamp. Database validation uses PGlite; it is not a native PostgreSQL concurrency benchmark. This update does not establish classifier recall or precision against an independently labelled national corpus. Source collection, original-document extraction and nationwide coverage remain incomplete.
