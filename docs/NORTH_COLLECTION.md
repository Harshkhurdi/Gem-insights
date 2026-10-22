# North-first collection

The current rollout adds 13 public-listing profiles, taking the project to **38 automatic profiles and 87 registered targets**. It covers additional public evidence from AIIMS Jammu (three lists), JKMSCL, SKIMS Srinagar (four categories), NHM Ladakh, KGMU, KCGMC Karnal (current/archive) and Haryana Health. These observations appear immediately in the main insights. Northern coverage remains partial; South expansion is on hold.

## Run the North queue on an existing Mac installation

Stop the running app, pull `main`, and add `COLLECTION_REGION=north` to your existing `.env`. Preserve your database URLs and administrator key. New installations already have this setting in `.env.example`.

```sh
git pull --ff-only origin main
npm ci
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

Open http://localhost:3000. The snapshot import is optional; it restores captured evidence without pretending that old sources were freshly read. Repeating it does not duplicate notices, reset reviews or replace newer local observations.

To collect directly once, use another terminal from the repository root:

```sh
npm run collect -- north
```

`COLLECTION_REGION=north` applies to the worker scheduler and the UI's bulk collection action. It prioritizes the 29 northern profiles, then four national profiles; other regional profiles are excluded. National feeds can include notices outside North. Existing stored observations stay visible. Explicit single-source actions remain available; already queued jobs are not cancelled by changing this setting. An installation without the variable retains the previous `all` behavior. `npm run collect -- all` explicitly selects every implemented profile.

## Northern coverage and remaining work

| State / UT | Implemented evidence | Remaining priority work |
| --- | --- | --- |
| Delhi | AIIMS current and three archives | RML Hospital listing returned HTTP 503; broader hospital/state-portal coverage and archive backfill |
| Punjab | AIIMS Bathinda | BFUHS tender page returned HTTP 503; additional hospitals and procurement agencies |
| Haryana | KCGMC current/archive; Health Department current list | HMSCL and UHSR returned HTTP 503; statewide historical coverage |
| Chandigarh | GMCH current/related procurement notices | PGIMER returned HTTP 503; additional hospitals and archives |
| Himachal Pradesh | AIIMS Bilaspur | IGMC Shimla homepage returned HTTP 503; state medical procurement and archives |
| Uttarakhand | AIIMS Rishikesh current/archive/quotations | Remaining AIIMS archive backfill, state procurement and other hospitals |
| Uttar Pradesh | UPUMS and KGMU | SGPGIMS returned HTTP 503; KGMU access is intermittent; other institutions/state procurement |
| Rajasthan | RMSC | AIIMS Jodhpur returned HTTP 503; broader hospital and historical coverage |
| Jammu and Kashmir | AIIMS Jammu, JKMSCL, four SKIMS lists | Other hospitals, statewide portal coverage and original-document review |
| Ladakh | NHM procurement links | Health department, district hospitals and historical/state-portal coverage |

HTTP results above describe checks on 22 October 2026 from this validation environment. They do not establish permanent site outages. Unsupported/access-blocked targets remain disabled assisted targets. CAPTCHA-based searches require a permitted import or source-specific public listing; this rollout does not bypass them. “Complete North” cannot be established from these partial institution lists alone. The table is the next-work order before South expansion.

## Evidence rules and fixes

- AIIMS Jammu demonstrably reuses some PDF URLs for unrelated titles. Title/document context now preserves those rows, while exact pairs can group across its three profiles. JKMSCL references and titles likewise protect against reused attachment paths. Explicit GeM references continue grouping normally.
- JKMSCL uses merged table cells and malformed older HTML. Valid reference/date spans are retained; malformed spans never invent inherited facts. Historical linked tables remain source observations, including amendments and evaluations rather than only currently open tenders.
- SKIMS pagination follows only advancing published offsets in each exact category. Jobs retain the existing 25-page budget, checkpointing and head refresh. All four captured lists reached their published last page; that does not establish comprehensive SKIMS history.
- SKIMS “Hits” are page views, not quantities. Upload/opening/generic start dates are not publication dates. KGMU submission ranges establish a closing date only; explicit closing columns remain listing claims. Undated records stay out of publication trends.
- Haryana Health's apparent archive contained template records sharing a sample PDF. That archive is excluded from this baseline. The implemented current list is separate.
- Listing titles establish provisional classification, not quantities, values or confirmed delivery locations. The common spelling “equipments” now also triggers the broad clinical candidate rule; it does not assign a particular product family.
- `npm run dev` loads root environment settings, keeps Next on `WEB_ORIGIN`'s port, and stops UI/API/worker process groups together after a failure or interruption. A crashed npm/Next parent cannot leave its child HTTP server listening. Backend edits still require a restart after compilation.

## Validation

The full automated suite passes **282 tests**. Production API/web builds, TypeScript and formatting checks pass. New regressions cover source layouts, strict pagination, date semantics, row spans, reused links, snapshot-safe identity, preserved reviews/checkpoints, North-only scheduling, and actual POSIX descendant shutdown. Database checks use temporary PGlite; native PostgreSQL concurrency remains a separate local check. Real-document extraction accuracy is still unmeasured.

A cold normal CLI import restored **14,996 real observations**, including **3,458 new northern observations**. It produced **14,823 grouped procurement records**, **7,822 provisional medical/clinical records**, and **119 matched equipment families**. The raw snapshot marks 7,887 observations medical; grouped counts are lower because references/documents overlap. Repeating the import returned 14,996 unchanged and zero inserted/updated. All source evidence and observation timestamps were preserved. A small part of the medical increase also comes from recognizing the existing “equipments” spelling.

| New profile group | Captured observations |
| --- | ---: |
| AIIMS Jammu, three lists | 310 |
| JKMSCL | 922 |
| SKIMS imports | 834 |
| SKIMS purchase I | 431 |
| SKIMS purchase II | 556 |
| SKIMS quotations | 10 |
| NHM Ladakh | 11 |
| KGMU | 200 |
| KCGMC current/archive | 183 |
| Haryana Health current | 1 |
| **Total additions** | **3,458** |

Most pages were collected through the bounded live collector. Its interrupted validation process retained the actual downloaded HTML, which was replayed through the same collector for a reproducible combined database. KGMU's successful earlier capture is used because subsequent reads returned a connection-error page. Per-notice observation times come from the actual HTML captures, rather than replay/import time. No synthetic fixture enters the baseline.

Compiled API checks passed for every new profile's explorer/details and the combined overview. Undated new-source records produce no fabricated publication trends. Listing quantities and values stay unknown, confirmed-delivery locations stay empty, and importing the two reviewed sample bids retains exactly **27 known requested units** without increasing the 7,822 medical-record total.

All **26 browser checks passed** against the production Next UI and compiled API using the refreshed canonical snapshot. They cover overview totals, equipment/products, map, buyer drilldown, trends, explorer details, CSV export, evidence/location filters, reviewed quantities and seven mobile views. Administrator login and the actual UI bulk action queued exactly 33 eligible North/national profiles, with no southern regional jobs. No browser, console or API errors were recorded. These checks run against the project in the validation environment, not the user's Mac localhost.
