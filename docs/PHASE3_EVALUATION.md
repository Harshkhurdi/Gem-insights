# Phase 3 evaluation, review and batches

## Setup and operation

Run `npm ci`, `npm run build -w @gem/api`, `npm run migrate`, then start the existing API, web app and persistent worker. Additive migrations `Evaluation1792408000000` and `EvaluationAttempt1792408100000` introduce corpus annotations/history, evaluation runs, attempts, frozen categories/methods, staged approvals, batch capacities and indexes. Previous migrations and the CSV/JSON import contract are unchanged.

1. Administration uploads up to **500 PDFs / 2 GiB** sequentially, one multipart request per file. Per-file **15 MiB / 80 pages**, **10 OCR pages**, 120-second subprocess timeout, 256 MiB V8 heap, local-only processing and separate content-retention permission remain. Legacy clients default to 20 files / 100 MiB unless `maxFiles` requests a larger capacity. At most 1,000 PDF jobs may be pending/running; further submissions return 429. One active worker processes one PDF at a time; this is a resource boundary, not measured production throughput.
2. The batch selector shows pending, terminal, failed/OCR-needed, staged and approved counts. Document lists paginate 30 at a time. A queued document may be cancelled before claim; nonretained bytes are purged. Running documents cannot be cancelled by that control. Retries check current state, source availability and queue capacity. Recovery marks interrupted attempts and requeues jobs; missing bytes require explicit reupload.
3. Inspect / review shows the original on the left and fields on the right. Evidence buttons navigate pages. PDF.js renders locally into a bounded-size canvas using a worker bundled from the installed dependency; document JavaScript actions, annotations and XFA are not executed. Retained files use the authenticated download route. For nonretained originals, select the exact file locally: checksum must match and the viewer uploads no bytes. Original remote URLs are never embedded/fetched by the viewer.
4. Correct fields/categories and approve through the existing transactional importer. To batch-approve, inspect each document/page and complete snapshot, then **Stage checked snapshot**. Batch approval attempts only individually staged documents. Editing invalidates staging and changed production hashes block stale imports. Each document remains an atomic transaction; one failure does not undo unrelated documents. Stable item keys and historical corrections retain the existing semantics.
5. Corpus annotations are separate. Expand **Independent corpus annotation and ground truth**, attest real-original versus synthetic status, and record selection/permission context. Known synthetic provenance cannot be marked real. Enrollment pins the latest parser observation and corresponding processing attempt. Existing reviewed drafts may prefill ground truth but never approve it automatically.
6. Inspect every original page. Correct the annotation, delete false positives, add missing items, set true product families (null means excluded), and explicitly match each true line to one parser line or no match. Matching is one-to-one. Tag equipment/format diversity and reviewer-confirmed error causes. Approve **ground truth only**: no demand record, quantity or production correction changes.
7. Run evaluation in Administration or:

```sh
npm run documents:evaluate
# Existing compatible command, using the same new evaluator:
npm run documents:accuracy
```

The commands use `DATABASE_URL`, save an immutable evaluation-run report and print JSON. Administration shows field metrics, per-document errors, pinned observation/parser/annotation versions and frequent failures. Data Coverage exposes aggregates; detailed annotations/errors stay administrator-only. Versioned annotation and production-review histories retain corrections and category choices. Ground truth requires structured-evidence retention rights, not full original retention.

## Methodology and denominators

Only explicitly attested real originals with approved annotations contribute. Drafts and synthetic cases are excluded. Zero approved real cases displays **Not yet measured**, with null rates. Fewer than 50 gives a limited-sample warning. Fifty is a collection target, not evidence of representativeness. Diversity tags reveal coverage gaps. Independent review and permissions are operator attestations in the current single-administrator application.

Per-field counts expose opportunities, truth-present, prediction-present, correct, incorrect, missing, spurious and both-absent values. Null/null (including unknown units) is excluded from accuracy. Comparisons normalize Unicode, case/whitespace, existing unit aliases, exact decimal strings and equivalent closing instants. Exact match means exact after these stated normalizations.

- Correct non-null value: TP. Wrong value: FP and FN. Missing true value: FN. Spurious value: FP.
- Precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN). Zero denominators give null.
- Exact match = correct/(correct+incorrect+missing+spurious). Missing-field rate = missing/truth-present. Correction rate = (incorrect+missing+spurious)/non-null comparison opportunities. This measures field corrections, not keystrokes or time saved.
- Line precision/recall/F1 use explicit matches, every parser item and every true item. Extra predictions are FP; unmatched true products are FN. Distinct item count is compared separately. Matching does not rely on row position or stable-key equality.
- Category false-positive rate uses truly excluded/unrelated items plus unmatched parser extras as negative opportunities. Wrong medical-family assignments also produce category FP/FN. Categories are frozen at extraction instead of recomputed with tuned rules. Legacy observations without frozen categories can contribute field comparisons but are excluded/disclosed in category metrics.
- Confirmed delivery sets compare state/district/city/explicit allocation tuples as multisets. Buyer location is never substituted; unallocated quantities stay unknown.
- Processing success means a completely readable extraction, not production approval. Failed/OCR-needed attempts stay in recorded-attempt denominators. Unrecorded legacy attempts are counted separately. Timing includes local processing, excludes upload/queue/review time, and reports its timed sample.
- OCR causation requires reviewer attribution; a mistake on a Tesseract document is not automatically an OCR mistake. Reports show document-level reviewer OCR-issue tags; field-level counts of OCR-caused mistakes remain unmeasured rather than attributing every error in a tagged document to OCR.

Selected-corpus measurements do not establish unseen-format or national accuracy. Overall heterogeneous field totals are micro-aggregates and should not be advertised as universal accuracy. Preserve a held-out set when tuning rules. Failed documents belong in the corpus, not only successful extractions.

## Extraction and reliability limits

`gem-pdf-2` reconstructs horizontal text rows/cells from PDF positions. Explicit description/quantity headers enable conservative requested-item table parsing: numbered rows, reordered positioned columns, some split rows across pages and repeated headers. Product `Quantity:` labels do not invent absent units. Hindi labels/digits, Unicode identities and selected medical aliases work; Hindi state translations and arbitrary bilingual layouts remain review tasks. Evidence/page references remain attached.

This is not a general image-table recognizer. Merged cells, rotated/multiple columns, unusual BOQs, distinct same-name rows, complex scans and partial amendments require review. Percentages/capacities are not equipment quantities. EMD/turnover is not an estimate. Confidence is heuristic. OCR subprocess termination forwards to the active native child. The V8 heap is not an OS memory cap or sandbox; use deployment CPU, memory, storage and network restrictions. Temporary cleanup still depends on the worker running.

## Actual data status

Authorized real originals evaluated: **0**. No new real records were acquired. Existing dataset: **two historical notices, 27 ventilators, one institution/buyer state**. Real precision/recall/F1, OCR recognition quality and throughput remain unmeasured. Native Poppler/Tesseract executables were unavailable here; missing-tool failure is tested. No production deployment or production-tested real corpus is claimed.

The target is at least 50 permitted originals across the checklist in `data/golden-corpus.json`. The corpus remains pending. See [source capabilities](SOURCE_CAPABILITIES.md) and [access request](GEM_DATA_ACCESS_REQUEST.md). No request was sent and no automated collection was enabled.

See [measured Phase 3 validation results](PHASE3_VALIDATION.md) for automated and browser verification and the exact real-document sample.
