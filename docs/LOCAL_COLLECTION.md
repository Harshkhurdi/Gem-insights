> Main-project integration: collected notices now appear automatically in the overview, product, buyer, geography, trend and explorer pages. See [main insights](MAIN_INSIGHTS.md). Item review adds verified detail; it does not block visibility.

> Current update: [Rajasthan/UP collection](STATE_MEDICAL_COLLECTION.md) brings collection to 23 working listing profiles and a 9,673-record discovery snapshot. Word/Excel/ZIP attachments and published amendment pointers remain review links; supported same-host GeM PDFs can be extracted locally. This supersedes earlier source and notice counts below.

# Local collection and medical demand workflow

This phase adds public-listing discovery to the existing local application. It preserves the Next.js/NestJS/PostgreSQL stack, PDF review, imports, corrections and SQL analytics. There is no hosted service or external LLM dependency.

## Update an existing installation

Back up PostgreSQL, pull the repository, then run from the repository root:

```sh
npm ci
npm run build -w @gem/api
npm run migrate
npm run dev
```

Open http://localhost:3000. Sign in with your existing `ADMIN_KEY` under **Administration**, then open **Tender Collection**. No database reset is needed. Existing records default to portal `gem`; native references are scoped by their portal to avoid collisions.

## Collect notices

The separate worker schedules enabled sources when it starts and checks for due work every 30 seconds. The three supported sources initially run every six hours. Click **Start collection** to queue all enabled sources, or **Collect** for one source. Repeated clicks do not create duplicate pending jobs for the same source. **Pause** stops future source jobs; an in-progress page may finish.

Supported adapters:

| Source | What is collected | Important limit |
|---|---|---|
| AIIMS Raipur | Published tender reference, title, publication/closing date, original and corrigendum PDF links | Listing metadata; no inferred item quantities |
| ICMR | Public tender titles, source links, closing dates, explicit GeM references | A source may list an original and corrigendum separately; institute/state require document review |
| CPPP central listing | Public title, native tender ID, buyer name, publication/closing dates and detail links | Latest active listing, not a national historical archive; state is not guessed from the buyer name |

The collector follows published Next links within that source's listing path. Each job has a 25-page budget, 2-second delay between pages, 30-second request timeouts and a 5 MB page limit. Each completed page commits its observations and checkpoint atomically. A failed request retains completed work. A job reaching its page budget resumes after 15 minutes. A successful end-of-list run schedules the next refresh. HTTP/access/layout errors are visible in the source table and Data Coverage run history. Access challenges are not solved automatically.

The initial rollout listed 52 targets and supported the three adapters above. The current registry has 66 targets and 23 automatic profiles; see the latest update at the top of this guide. Other URLs are planning/assisted-import targets, not proof of collection or individually validated coverage. Punjab, Chandigarh and Himachal Pradesh active-search pages presented CAPTCHA searches in this check. GeM direct collection remains unavailable; authorized feed and imports still work.

To collect from the command line against your configured local database:

```sh
npm run collect -- aiims-raipur
npm run collect -- icmr
npm run collect -- cppp
npm run collect -- all
```

A per-source database lock prevents simultaneous CLI/worker collection of that source. `COLLECTION_ENABLED=false` disables automatic scheduling. Source pauses also prevent manual collection. Scheduling, checkpoint recovery and processing run only while the PC, PostgreSQL and worker are running; closing the browser does not stop the worker.

## Inspect discoveries

The default scope shows broad medical/equipment candidates. Choose **All collected notices** to find unfamiliar products and classification misses. Filter by source, recorded buyer state, equipment candidate, review state or title/reference. **Export current page** exports up to 25 matching records with filter/coverage metadata.

Discovery counts refer to stored listing notices. The same bid can appear in more than one source or as original/corrigendum notices. Candidate product counts overlap. Neither is a verified unique national tender count or a quantity total. Civil work, maintenance and consumables can remain visible for review; they do not become equipment quantities.

## Review into demand analytics

1. Click **Review** and open the official notice plus all relevant original/corrigendum documents.
2. Enter or verify the complete tender JSON. For a native reference, preserve its exact portal and reference. For a listing without a reference, identify one from the original document before approval. Never invent an official bid number.
3. Set an explicit stable buyer key and source-recorded buyer identity. Verify state/district from the document; leave unknown locations null. Buyer location is separate from confirmed delivery destinations.
4. Enter **every** equipment line with a stable key, original name and page evidence. Use `quantity: null`, `estimatedValue: null` and `unit: "unknown"` when absent. Do not interpret technical specifications as quantities or prices.
5. Verify the complete current snapshot and enter a review reason. Approval imports atomically through the existing importer. Product, buyer, geographic and trend views then use the reviewed items.
6. Dismiss unrelated notices with a reason. Discoveries and source observations remain auditable.

If an existing tender matches the portal/reference, its current complete record is loaded into the editor. Approval replaces that snapshot, so preserve other lines and reconcile amendments. A changed notice or concurrently edited tender causes a conflict and requires reload. Existing manual line corrections survive stable keys. A changed source listing returns the discovery to pending review while retaining the previously approved tender; it never silently rewrites verified quantities.

The existing automatic PDF extraction editor still targets GeM-format PDFs. Native institution/CPPP notices can be reviewed through Tender Collection or imported as complete CSV/JSON. Native-format PDF extraction and automatic BOQ interpretation remain unfinished.

## Import native tenders directly

Add `sourcePortal` to JSON records or CSV headers. Allowed values: `gem`, `cppp`, `state`, `institution`. Omit it for existing GeM imports. `bidNumber` holds the original reference; GeM references still require `GEM/year/B-or-R/number`. Native references are not converted into fictitious GeM IDs. CSV groups records by portal plus reference.

## What remains before national coverage can be claimed

- Working, individually verified adapters/access routes for GeM, state portals, remaining institutions and historical archives.
- Reliable item/quantity extraction and measured accuracy across real native documents/BOQs.
- Representative reviewed data across states and buyers, with comparable collection windows and a credible completeness denominator.

The application reports these gaps rather than treating registered sources, keyword candidates or a successful listing scan as all-India medical demand.

## Included real discovery snapshot

The initial `data/discovery-baseline.json.gz` preserved the metadata collected in its first live validation: **1,909 notices**, including **550 broad medical/equipment candidates**, across 25 pages from each of the three adapters (75 pages total). All three jobs reached their page budgets, with page 26 retained for continuation. These are original/corrigendum listing observations, not 1,909 unique national equipment tenders. Candidate classification can change when local taxonomy aliases are edited.

After migrations, optionally load this snapshot into the discovery queue:

```sh
npm run import:discoveries
```

It adds no verified equipment quantities. Repeating it is idempotent. Snapshot timestamps remain historical, current source success/checkpoints are not rewritten, and newer local observations are preserved. Continue with **Start collection** for fresh live reads, then review original source documents before approving items into demand analytics. Full PDFs are not bundled.
