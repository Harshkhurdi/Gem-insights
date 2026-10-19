# PDF ingestion validation — 19 October 2026

The existing application was extended in place. The original CSV/JSON import contract, stable tender and item identities, transactional snapshots, manual classification corrections and analytics endpoints remain supported.

## Automated validation

- 92 tests pass against an isolated real PostgreSQL 18 database: the original 50 tests and 42 additional PDF/parser/workflow/HTTP regression tests.
- API and Next.js TypeScript checks, Prettier format check, API production build and Next.js optimized production build pass.
- Additive TypeORM migrations are exercised against the real test database. No production schema synchronization is used.
- An actual multipart HTTP upload reaches the separate worker, produces a review draft, stays outside analytics until explicit approval, and appears in analytics after approval. Identical PDF bytes reuse the document and do not create another tender.
- Regression coverage includes multiple products, absent quantities, stable item keys across revisions, exclusion of services/accessories, confirmed destination allocations, stale approvals, correction preservation, immutable extraction observations, partial batch failures, upload limits, rights requirements, private originals, purging of nonretained bytes and abandoned temporary files, and document retry checks.
- Optional OCR missing-tool failure is tested. Native Poppler/Tesseract recognition was not calibrated in this environment.

## Real-document evaluation

**Permitted original PDF golden corpus: 0 documents. Independently reviewed original PDFs: 0. Real-PDF extraction accuracy: unmeasured (null).** The target remains at least 25 varied documents once authorized originals and review rights are available. Synthetic generated PDFs verify implementation behavior and are not evidence of real-world extraction accuracy.

The two existing source-linked AIIMS Bathinda bid records remain factual metadata references. Their original PDF files are not included in the golden corpus, and no reusable corpus permission is inferred from public availability. See `data/golden-corpus.json` and `SOURCE_RESEARCH.md`.

`npm run documents:accuracy` compares immutable initial parser observations with approved operator-reviewed snapshots. It reports the actual evaluated sample, non-null field agreement and stable-key line-item precision/recall. It is a selected-sample agreement measure, not an independently sampled accuracy benchmark. With no approved PDF records it returns zero evaluated documents and null agreement/precision/recall.

## Manual inspection and limitations

Browser inspection verified administrator authentication, upload permission/retention controls and processing/review status UI. A browser file-selection attempt was interrupted by a host transport failure; the complete browser upload flow was not verified. The equivalent upload/worker/review/analytics path is covered by the automated HTTP integration test.

Extraction is conservative and deterministic. Complex tables, unusual GeM templates, multilingual scans and standalone amendments require careful human review. Confidence values are heuristics. Approval requires review of every original page and a complete current snapshot; drafts never become production snapshots automatically.

No new live GeM access, national coverage, production deployment or bulk-data permission is claimed. The written access request is prepared in `docs/GEM_DATA_ACCESS_REQUEST.md` and has not been sent.
