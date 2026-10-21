# Local collection validation

Validated 21 October 2026.

## Implemented

- Durable public-listing adapters for AIIMS Raipur, ICMR and CPPP central active tenders, with published pagination, page checkpoints, bounded jobs and source errors.
- A 52-target source registry including all 36 state/UT procurement targets. Registry presence is not collection coverage.
- Separate notice discovery, review, original-document links, observations and verified tender analytics.
- Portal-scoped native tender identities; unchanged default GeM import/PDF workflows.
- 105 medical equipment families across 17 clinical categories; plural matching and the Lab Medicine department exclusion fix.
- Local collection UI, source pause controls, CSV export, stale-review protection and exact reviewed quantities.

## Automated checks

Production build, TypeScript type checking, Prettier check and git whitespace validation pass. The final combined suite passed **152/152 tests** with zero skips or failures. The production web build, API build, TypeScript check, Prettier check and whitespace check also passed.

Tests cover original imports, PDF extraction/review/evaluation, HTTP authorization/origin protection, deterministic classification, geographic accounting, idempotence, page-failure recovery, native identities, changed-source review, stale tender conflicts, queue deduplication and token-independent CPPP identity.

The execution host did not provide a runnable native PostgreSQL service. Database-dependent tests were exercised through PGlite 0.5.10 with its PostgreSQL wire socket 0.2.13 in an isolated temporary database. SQL migrations, transactions, API and worker behavior passed there. PGlite multiplexes connections, so this does **not** establish native PostgreSQL lock contention, real multi-worker exclusion or production scalability. Re-run `npm test` against the isolated PostgreSQL 16+ `_test` database on the local PC for those operational checks. No application database was replaced with PGlite, and no extra test-runtime dependency was added to the repository.

## Live source observations

Direct public HTTP reads returned real tender tables for the three enabled sources. All three collectors completed 25-page jobs and retained page 26 for continuation. The real metadata snapshot contains 1,909 notices: AIIMS Raipur 438 (397 broad candidates), ICMR 1,250 (145), and CPPP 221 (8). Total broad candidates: 550. None was auto-approved into verified equipment demand. The optional compressed snapshot importer was tested twice: 1,909 inserted, then 1,909 unchanged, with zero tender demand records added. No listing title or total has been treated as verified equipment quantity.

GeM and AIIMS Delhi were unavailable from this environment during the probe. Punjab, Chandigarh and Himachal Pradesh active-search pages returned CAPTCHA forms, not result lists. They remain assisted targets. No CAPTCHA or session protection was bypassed.

## Browser checks

A local Chromium browser exercised Tender Collection navigation, discovery rendering, administrator sign-in, the source-review dialog and Start collection. A 390-pixel mobile viewport reported 390-pixel body width, with no uncaught page errors. Desktop and mobile screenshots were inspected.

## Remaining limits

Nationwide completeness is unknown. Listing discoveries can overlap across portals and amendments. Original item quantities still need source review; native non-GeM PDF/BOQ automation and real-document accuracy measurement remain unfinished. This phase is a working collection increment toward the national medical-demand vision, not a completed national dataset.
