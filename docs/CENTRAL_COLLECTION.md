# Central India collection — AIIMS Bhopal and CGMSCL

The Central rollout takes the registry to **56 automated public listings and 105 registered targets**. Research on 23 October 2026 found the region's two largest institutional publishers reachable and implemented them; MPPHSCL's listing was session-bound and stays assisted.

| Source | Profile | First live run (23 Oct 2026) |
| --- | --- | ---: |
| AIIMS Bhopal | `aiims-bhopal` | 1,856 observations (1,307 medical) |
| CGMSCL equipment tenders | `cgmscl-equipment` | 989 observations (221 medical, 194 GeM references) |
| MPPHSCL | `mpphscl` (assisted) | Listing links session-bound; homepage reachable |

## AIIMS Bhopal

Every procurement category is published on one large page whose sections are bold headings followed by tables. The medical sections are collected — manual tenders, medical-college and hospital e-tenders, expressions of interest and NIQ quotations; engineering (civil/electrical works) sections and the vendor list are excluded from requested-demand collection.

- Publication and closing columns are explicitly labelled and become dated records (1,846 of 1,856 reach back to January 2014); unknown dates stay unknown.
- Placeholder epoch dates the publisher prints beside portal references ("01-Jan-1970") never become bid dates.
- Native references (`AIIMS/BPL/CS/…`, NIQ/LPC ids) are normalized for spacing only; titles carrying GeM bids keep GeM identity (132 observations).
- Layout guards fail visibly when a medical section, a labelled column or a row changes.

## CGMSCL equipment

- Titles carry native references (`271/CGMSCL/2026-27`) and GeM bid numbers, sometimes printed **without separator slashes** (`GEM 2026 B 8053870`). Separators of the publisher's own rendering are normalized to the canonical GeM identity; no reference is ever constructed that the page does not print.
- Row detail/attachment pages (`AttachmentList.aspx?a=…`) are plain links retained as evidence; listing scans do not fetch their content.
- No dates are published on this listing, so no publication trends are invented.
- Drug, quality-control, civil and other category pages exist and remain future work.

## MPPHSCL (assisted)

Homepage reachable, but tender listing links (`TenderALL.aspx`) returned HTTP 403 and content pages redirect to a session error page; the encoded navigation tokens appear session-bound. No automated collection; `mptenders` (NIC) and AIIMS Bhopal provide separate partial coverage.

## Validation

All **322 automated tests pass** (9 new Central regressions), with production builds, TypeScript and formatting checks. Live collection ran against both publishers. A new **cystoscopes** equipment family (added from real Bhopal listing evidence) also reclassified existing notices; the two reviewed Bathinda records still contribute exactly 27 known requested units, and confirmed-delivery results remain empty.
