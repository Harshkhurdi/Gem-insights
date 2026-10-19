# Authorized PDF processing and review

This extends the existing application; CSV/JSON imports, analytics endpoints and historical tender identities remain compatible.

## Setup

Use Node **22.13+** (Node 24 recommended), `npm ci`, and the existing PostgreSQL environment. Apply all additive TypeORM migrations before starting either service:

```sh
npm run build -w @gem/api
npm run migrate
npm run dev
```

The API and separate worker must share a private writable `DOCUMENT_STORAGE_DIR`, default `.runtime/documents`. Keep it outside any static/public web directory. Use restricted filesystem permissions, deployment access controls and encrypted storage where appropriate. A separate worker on another host requires a private shared filesystem mounted at the same configured path. No PDF bytes are stored in Git or exposed by a public route.

The maintained `pdfjs-dist` dependency extracts embedded text in a child process. Its standard font files load locally from `node_modules`; no source URL is fetched. Document JavaScript actions are not executed; XFA and remote worker fetching are disabled. PDFs and extracted text are never sent to an AI or OCR web service.

## Optional local OCR

Install **Poppler** (`pdftoppm`) and **Tesseract**, including the selected local language data:

```sh
# macOS
brew install poppler tesseract
# Debian/Ubuntu
sudo apt-get install poppler-utils tesseract-ocr tesseract-ocr-eng
```

Configure `PDFTOPPM_BIN`, `TESSERACT_BIN` and `OCR_LANGUAGES` if executable paths or languages differ. Enable OCR per upload batch or when retrying a retained document. Images are rasterized locally and passed to the local Tesseract executable. Temporary page images are removed after processing. With no installed tools, OCR fails explicitly and the document remains outside production analytics. Native OCR recognition quality was not calibrated in this environment; no OCR accuracy claim is made.

## Administrator workflow

1. Sign in with the existing administrator session. In Administration, choose **Authorized PDF ingestion and review**.
2. Identify the source institution/portal, batch provenance and the actual permission reference. Confirm permission to process and retain structured fields/minimal evidence. Original PDF/full-text retention is a separate optional permission, off by default. Enable optional OCR only if needed.
3. Select up to 500 PDFs / 2 GiB in the current Administration interface. Legacy clients default to 20 PDFs / 100 MiB unless requesting a larger batch. Supply an original source URL for each when known; it can be completed at review. Each file uploads independently with transfer progress, duplicate detection and a clear result. No URL is fetched automatically.
4. Keep the persistent worker running. Statuses are queued, extracting, review, needs OCR, failed, deferred, rejected or approved. Errors are specific to each document; a broken file does not roll back successful processing of another file.
5. Open **Inspect / review**. Check extracted identity, publication/closing dates, institution/department, original item names, quantities/units, specifications, estimates and confirmed destination allocations. Editable fields and original page evidence appear together. Unknown data remains null. Use a saved buyer identity only when the source supports that match. Advanced JSON is available for unusual fields, source-revision timestamps and stable source keys.
6. Inspect every original page. For retention-enabled documents a private authenticated download is available. Otherwise use the authorized original still on your device: the uploaded bytes and full page text are not retained. Evidence quotes, page numbers, checksum and extracted fields remain available under the evidence permission.
7. Correct, add, split or remove requested line items. Preserve stable keys for genuine revisions; suggested matches to an existing record are explicitly flagged. Classification overrides can exclude an accessory/service line or select a medical product. Saved draft overrides persist across sessions.
8. Save, defer or reject as appropriate. Approval requires an explicit assertion that every source page was reviewed and the record is a **complete current tender snapshot**. An extension/corrigendum is not automatically merged as a complete tender. Missing identity/source fields, invalid allocations, stale draft versions or a changed production snapshot block approval.
9. Approval and the existing transactional import commit together. Existing corrections survive stable item keys; new manual overrides are audited. Duplicate approval is idempotent. The dashboard then reads the approved record through the unchanged analytical engine.

## Retention and failure handling

- Nonretained source bytes are deleted after extraction succeeds or fails. Full page text is stored only with content-retention permission. Minimal permitted evidence and structured specifications remain reviewable. Permission is operator-attested, not independently certified by the application.
- A worker cleanup pass expires abandoned nonretained uploads and strictly named orphan temporary files after 24 hours. It runs on worker startup and approximately every minute; it cannot run while the worker/host is stopped. Retained source PDFs are preserved.
- Identical SHA-256 bytes reuse the existing document identity, processing state and original retention policy. Reupload cannot silently expand retention rights. A failed/OCR-needed ephemeral document can be reattached explicitly for reprocessing. Retained failed documents can be retried without reupload.
- PDF failures become terminal jobs with a clear error; retries are explicit because a nonretained input may already have been purged. Existing CSV/feed jobs retain their three-attempt backoff policy.
- Changing the draft does not overwrite the append-only extraction observation. Review actions and structured records are audited separately from raw source observations.

## Resource limits

| Resource | Limit |
|---|---|
| Per uploaded PDF | 15 MiB |
| Per batch | Up to 500 distinct PDFs / 2 GiB; default API capacity 20 / 100 MiB |
| Pages per PDF | 80 |
| Optional OCR pages per PDF | 10 |
| PDF subprocess | 120-second timeout / 256 MiB V8 heap budget |
| Native OCR commands | 30-second timeout per command |
| Extracted text | 60,000 characters/page; 500,000/document |
| Review record | 250 KB |

The V8 heap budget is not an OS sandbox or a hard cap on native allocations. Run the worker as a least-privilege process/container with host CPU/memory/network restrictions and keep PDF/OCR dependencies patched. Password-protected PDFs, malformed files, unsupported encodings and complex BOQ tables can require manual handling. This deterministic parser is deliberately conservative; it does not provide layout-general document understanding.

## Extraction and accuracy

Explicit requested-item headings such as `Patient monitor ( 12 pieces )` are supported. Multiple headings become distinct items. Item-category/total-quantity fallback is conservative; a bundled total is never copied to every product. GeMARPTS search-result matches are not actual line items. Postcodes, office names and buyer addresses do not become confirmed delivery states. Only explicit estimates are captured; EMD and turnover are not prices. Confidence is heuristic, not a calibrated probability.

Run `npm run documents:evaluate` or `npm run documents:accuracy` after independently approving corpus annotations. The Phase 3 evaluator uses frozen observations, explicit line matching and sample sizes; corpus approval does not import demand. Zero real cases displays Not yet measured. CLI/admin error reports include permitted structured field comparisons and stay within the operator's environment; public coverage exposes aggregates. No documents are downloaded. See [Phase 3 methodology and workflow](PHASE3_EVALUATION.md).

See [Phase 2 validation](PHASE2_VALIDATION.md), [golden-corpus manifest](../data/golden-corpus.json) and [source access request](GEM_DATA_ACCESS_REQUEST.md).
