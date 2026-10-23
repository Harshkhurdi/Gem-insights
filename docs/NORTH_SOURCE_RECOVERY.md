# Northern source recovery — Jodhpur, SGPGIMS, PHSC, HMSCL

This North-first update rechecks the sources that returned HTTP 503 or connection failures on 22 October 2026. Four previously inaccessible publishers now have working automated profiles, taking the registry to **54 automated public listings and 102 registered targets**. Checks used ordinary public HTTP access from this environment on 23 October 2026; no CAPTCHA, authentication or anti-bot control was bypassed.

| Source | Recheck result | Profile |
| --- | --- | --- |
| AIIMS Jodhpur | Listing reachable; explicit tender references including GeM bid numbers | `aiims-jodhpur` |
| SGPGIMS Lucknow | Listing reachable; notice descriptions with linked original PDFs | `sgpgims` |
| Punjab Health Systems Corporation | Procurement-wing tables reachable; native BID numbers and documents | `phsc`, `phsc-archive` |
| HMSCL Haryana | Equipment-tender table reachable; publisher explicitly reports no matching tenders | `hmscl` (honest empty listing) |
| PGIMER Chandigarh | Homepage reachable; tender listing served only through an interactive JSP search form without a stable listing URL | remains assisted |
| BFUHS Punjab, IGMC Shimla, RML Hospital, UHSR Rohtak | Still connection-failed/503 in this environment | remain disabled; recheck later |

## Captured observations (first live runs, 23 October 2026)

| Profile | Observations | Medical signals | Pages |
| --- | ---: | ---: | ---: |
| AIIMS Jodhpur | 323 | 213 | 7 |
| SGPGIMS | 59 | 28 | 1 |
| PHSC current | 99 | 44 | 11 |
| PHSC archive | 1 | 1 | 1 |
| HMSCL equipment | 0 (explicit empty) | 0 | 1 |

Counts describe the first captures, not permanently fixed source totals. These records appear immediately in the main insights with listing evidence; quantities, values and confirmed delivery locations remain unknown until reviewed originals exist.

## Evidence and identity rules

- Jodhpur publishes explicit GeM references (for example `GEM/2026/B/8077851`) alongside native `AIIMSJ-…` references. GeM identities group across sources; native references stay institutional. Generic Start/End listing dates are not asserted as original publication; End is retained only as a listed closing claim.
- Jodhpur paginates with its own numeric pages (`tenders.php?page=N&search=`). Collection follows only single advancing positive page parameters with an empty search filter; any other query fails visibly.
- SGPGIMS lists notice descriptions whose linked phrase is the title, with original PDFs resolved against the official host. Estate and auction notices remain visible without medical claims. No dates or references are published on this listing; document links establish identity.
- PHSC publishes the meaningful subject inside the linked phrase; trailing format/size chrome is publisher interface detail, not notice content. Native BID numbers are normalized for spacing only (`PHSC/Proc/2026/Quotation-EDL Medicine/69`). Generic Start/End dates are not asserted as publication. The current list paginates through Drupal's zero-based pager; only single advancing numeric `page` parameters are followed. The archive table orders its columns differently; the parser follows the published header order. PHSC also requires a TLS legacy-renegotiation compatibility mode that is restricted to this one host; it changes the TLS mode only and adds no access bypass.
- HMSCL's equipment-tender table has reference, title, status, document and corrigendum columns. The publisher's explicit "No published tenders match these filters" state is recorded as an honest empty listing, not zero statewide demand. Free-text important dates are not parsed into bid dates. A populated row that differs from the validated seven-column layout fails visibly rather than being misread.
- The two reviewed AIIMS Bathinda records still contribute exactly **27 known requested units**; listing evidence never contributes quantities.

## Validation

All **313 automated tests pass** (15 new regressions covering Jodhpur GeM/native references and strict pagination, SGPGIMS title/document identity and non-medical estate notices, PHSC reference normalization, format-chrome stripping, header-order-following and Drupal pager rules, HMSCL empty/row states, first-class main-insights integration, GeM grouping across profiles, migration pause preservation and the 49-profile North queue). Production API/web builds, TypeScript and formatting checks pass.

Live collection runs against the real publishers produced the table above. Rajasthan, Punjab and Uttar Pradesh gain medical insight records from institutions beyond the previous coverage; `confirmed-delivery` results remain empty and no publication trends are invented from generic listing dates.
