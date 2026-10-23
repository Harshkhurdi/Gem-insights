# Notice types and requested-demand metrics

This update adds Safdarjung Hospital's current and archived procurement lists and separates non-demand notices from requested-demand insights. The registry now has **51 automated profiles and 102 targets**. North-mode collection selects **42 northern plus four national profiles**. South expansion remains on hold; North coverage is still partial.

All collected observations remain stored and searchable. The main overview, product, buyer, map, trend and explorer pages exclude listing records clearly identified as cancellations, contract awards/orders, disposal auctions, purchase reports or procurement guidance/forms. The new **Notice type** filter in Tender Collection retrieves these records, and collection CSV exports retain their readable type. The main evidence selector is now labelled **All demand evidence** to explain its scope.

## Definitions and current counts

Types are conservative title-based classifications, not independently verified lifecycle states. Unclear records stay eligible rather than being silently hidden. An unknown type does not establish an open or valid bid. A cancellation/award listing is not used to rewrite an entire bid's status or erase its original request; the supporting observation remains in collection. Reviewed item records retain the existing explicit-status and quantity rules.

| Type | Observations | Included in listing-demand metrics? |
| --- | ---: | --- |
| Procurement request | 8,960 | Yes |
| Amendment / clarification | 2,411 | Yes; explicit bid references group where available |
| Type unconfirmed | 5,023 | Yes; provisional |
| Cancellation / withdrawal | 288 | No |
| Contract award / order | 18 | No |
| Disposal / auction | 52 | No |
| Purchase report | 29 | No |
| Procurement guidance / forms | 1 | No |
| **All observations** | **16,782** | **388 non-demand observations retained outside listing-demand metrics** |

The remaining 16,394 eligible observations produce **16,231 grouped procurement-demand records**, including **8,874 provisional medical/clinical records across 122 matched equipment families**. Grouping reduces eligible observations by 163 because known references and matching documents overlap. Raw medical/clinical candidate observations total 9,088, including some records excluded by notice type. Requested quantities, values and confirmed delivery locations remain unknown for listing-only evidence.

The previous medical total of 8,959 included some non-demand notices. The new 8,874 figure reflects the new definition while adding 126 historical Safdarjung observations; it is not evidence of a market decline or lost data. Counts across classification/filter versions should not be treated as market growth. Original dates, links, references and observation times remain preserved.

## Safdarjung evidence and access

The current source is https://vmmc-sjh.mohfw.gov.in/tenders and its archive is https://vmmc-sjh.mohfw.gov.in/archive-tenders. Their downloaded public pages from **22 October 2026** contain **35 current and 91 archived observations**. These captures include 70 eligible demand/uncertain observations and 56 non-demand observations. They were validated through the same collector using the saved public HTML and actual capture timestamps.

Direct requests from this environment returned **HTTP 503 on 23 October 2026**. The implementation does not claim a fresh successful collection or continuous source availability. Source access notes record this limitation; normal runtime failures remain visible and retain earlier data with bounded retry scheduling. A registered working parser does not establish complete source or regional history.

The generic Date column is not asserted as original publication or closing date. Source titles and original/amendment links are retained. Complete slash/hyphen GeM references are normalized only when the full year/type/number is explicit; PDF filenames alone do not establish a GeM reference. Reused attachment paths retain title context, while exact document/title pairs can group across the two profiles. Missing originals retain explicit source-listing fallbacks. Published external attachment links are review evidence; automatic document retrieval keeps its existing same-host GeM-PDF restrictions. Unfamiliar table layouts or added HTTP pagination fail visibly rather than silently truncating collection.

Purchase-report examples include the publisher's “List of equipment procured” and “Procured for the period” titles. A procurement form is not an equipment request. Conversely, biomedical-waste disposal service tenders remain procurement requests: the rules do not blanket-exclude every title containing the word disposal. A list of items **to be procured/purchased** stays eligible; it is not a completed-purchase report. Explicit awards and auctions still take precedence. Type inference remains incomplete and can miss unfamiliar wording; collection provides the full retained evidence for review.

## Update an existing Mac installation

Stop the app and run from the repository root, preserving your private `.env` credentials and `COLLECTION_REGION=north`:

```sh
git pull --ff-only origin main
npm ci
docker compose up -d --wait postgres
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

Open http://localhost:3000. The migration refreshes derived classifications and insight views without resetting operator review decisions, observation ages, original evidence or history. Reimporting the snapshot does not duplicate records or replace newer local observations. An existing database can have different totals because of newer collections, reviewed imports, dismissals or customized aliases. Use **Tender Collection → Notice type** to find notices excluded from demand charts.

## Validation

All **319 automated tests pass**, including 21 new classification/parser/database regressions. Production API/web builds, TypeScript, formatting and diff checks pass. Tests cover each notice type, conservative inclusion, generic dates, full GeM references, reused/missing originals, layout/pagination errors, collection filters, demand exclusion, original-request preservation after related award/cancellation notices, local pauses, operator reviews, observation history/age and the 46-profile North queue. A strengthened parser check also verifies retained external evidence links without fetching them.

A cold normal CLI import restored **16,782 records**, preserving all source evidence and observation timestamps. Reimporting the 126 new observations returned 126 unchanged and zero inserted/updated. The compiled API passed per-type collection filtering, invalid-type rejection, main-source overview/explorer/detail checks, unknown-quantity handling and undated-trend checks. The two reviewed sample bids retain exactly **27 known requested units** without increasing the 8,874 medical-record total. Database validation uses temporary PGlite; native PostgreSQL concurrency and real-document extraction accuracy remain separate checks.

All **28 production-browser checks passed**. They cover revised main views, six notice-type filters, retained purchase reports/awards/auctions/forms, readable CSV type exports, collection-versus-demand totals, reviewed quantities, seven mobile views and the authenticated UI bulk action queuing exactly 46 North/national profiles. No browser, console or API errors were recorded. These checks run in the project validation environment, not the user's Mac localhost.
