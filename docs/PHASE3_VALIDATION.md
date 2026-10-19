# Phase 3 validation — 19 October 2026

## Measured results

| Check | Result |
|---|---|
| Automated regression suite | **125 passed, 0 failed, 0 skipped**; includes all previous 92 tests and 33 new tests |
| `npm run build` | API TypeScript and optimized Next.js production build passed |
| `npm run typecheck` | Passed |
| `npm run format:check` | Passed |
| `git diff --check` | Passed |
| TypeORM migrations | Both Phase 3 migrations applied successfully to the isolated real PostgreSQL 18 test database and the local application database |
| `npm run documents:evaluate` | Succeeded; **Not yet measured**, 0 real originals, null accuracy/precision/recall/F1/timing |
| Existing application data after migration | **2 unique notices, 27 requested ventilators, 0 uploaded original PDFs, 0 approved real corpus annotations** |
| Authorized new real documents | **0**; no real dataset expansion or production accuracy claim |
| Native OCR recognition | Not tested: local Poppler/Tesseract executables unavailable. Missing-tool failure path passes |

Tests run against an isolated database whose name ends `_test`. Generated documents, metric simulations and new regression cases are synthetic and never establish real-world accuracy. No original tender PDF is committed to Git.

## Tested behavior

New tests cover empty and synthetic-only corpus results; explicit item matching across renamed keys; extra/missing items; exact decimals and normalized units; FP/FN/F1 and denominator calculations; negative classification examples; failed documents; delivery allocation comparisons; OCR cause attribution limits; legacy missing categories/timing; corpus version/audit/isolation; original-page review and one-to-one matching requirements; frozen observations; 105-document upload/queue pagination; queued cancellation and byte purge; staged-only batch approval; stale snapshots; field-quality percentages; source filtering; monitor aliases/Hindi identities; 1,000-job backpressure; authenticated evaluation routes; and JSON-null responses for unenrolled corpus records.

Parser regressions include labelled product quantities with unknown units, technical oxygen percentages that do not become equipment counts, numbered multi-product tables, repeated page headers, split rows with evidence from both pages, positioned column order, Unicode/Hindi labels/digits and service/accessory/medicine/civil exclusions. Existing tests continue to cover original multipart uploads, a real separate worker, malformed files, per-file limits, duplicates, partial failures, stable keys, amendments, corrections, allocation correctness, atomic import, counts/months/financial years and session/origin controls.

The 105-document test measures upload registration, queueing, quotas and pagination; it does **not** demonstrate processing 105 real PDFs or production throughput. A representative real corpus and deployment load test remain necessary.

## Browser verification

A production-built Next.js instance, NestJS API and worker were started using only the isolated test database and a generated PDF prominently marked SYNTHETIC TEST ONLY. Verified:

1. Administrator sign-in and separate processing/evidence/content permissions.
2. File-chooser upload with original URL, transfer result, worker extraction and review status.
3. Visible original PDF beside prefilled bid, buyer, dates, patient monitor, **12 units**, specifications and delivery evidence.
4. Independent synthetic corpus enrollment/annotation approval without production import; explicit category/matching controls and review acknowledgement.
5. Individual staging, batch approval and a product ranking with **one synthetic tender / 12 units** in the test database.
6. Evaluation displays **Not yet measured / 0 real documents**, explicitly excluding the approved synthetic annotation.

Browser inspection exposed a blank native PDF frame; it was replaced with a bundled local PDF.js canvas renderer and visually verified. It also exposed empty responses for unenrolled annotations; the API now returns JSON null and an HTTP regression protects it. Test services/browser were stopped after verification. These synthetic browser checks are not real-source validation or a production deployment. Local nonretained viewer checksum logic is implemented; its complete native file-selection flow was not separately exercised here.

## Acquisition and remaining limitations

Official GeM enquiry routes remain the practical next step; no suitable authorized bulk tender API/feed or reusable original corpus was established. CPPP and Punjab are documented as distinct future sources with owner/third-party rights requirements. OGD pages retrieved during research included a sandbox/incomplete-data notice; no appropriate licensed line-item dataset was verified. The improved access request remains unsent. Automated collection remains disabled.

The target is at least 50 authorized diverse originals with independently reviewed annotations, including failures and negative cases. Classification and extraction precision/recall/F1, real scanned/Hindi/complex-table recognition, representative accuracy and throughput are still unmeasured. OCR causes are recorded at document level; field-level OCR-caused error counts are not claimed. The deterministic table parser covers explicit supported structures and still requires review for unusual layouts/amendments. Host/container resource isolation, production deployment, durable storage quotas and backups remain operator deployment work.

See [Phase 3 workflow and methodology](PHASE3_EVALUATION.md), [source capability matrix](SOURCE_CAPABILITIES.md) and [access request](GEM_DATA_ACCESS_REQUEST.md).
