# South India collection — Mangalagiri, Bibinagar, JIPMER

The South rollout begins with three large institutional publishers across Andhra Pradesh, Telangana and Puducherry, taking the registry to **59 automated public listings and 107 registered targets**. All were researched and validated on 24 October 2026.

| Source | Profile | First live runs (24 Oct 2026) |
| --- | --- | ---: |
| AIIMS Mangalagiri | `aiims-mangalagiri` | 993 observations (477 medical, 989 dated) |
| AIIMS Bibinagar | `aiims-bibinagar` | 460 observations (324 medical) |
| JIPMER Pondicherry | `jipmer` | 399+ observations and backfilling (257 medical; archive to May 2025) |

## Evidence rules

- **Mangalagiri** publishes a single-page register with CPPP tender IDs (`2026_AIMSM_931310_1`), explicit publish dates, documents, corrigenda and purchase-order links. CPPP-format references group with CPPP portal observations; award/purchase-order columns are lifecycle evidence, never requested-demand proof. Titles are trilingual — the English span is the notice text.
- **Bibinagar** tables carry native `AIIMS/BBN/…` references and GeM bid numbers; the linked phrase is the notice title and dummy `href="#"` anchors are ignored. Generic Start/End dates are not asserted as publication; End is a listed closing claim. Some genuine rows omit one trailing column; compact six-column rows are read at fixed positions, and other shapes fail visibly.
- **JIPMER** publishes explicit Date of Release and Last Date columns; the deep Drupal archive paginates with zero-based numeric pages and only single advancing pages are followed from the saved checkpoint. JIPMER's server omits the intermediate certificate in its TLS chain; the named public Sectigo intermediate is bundled so verification stays fully enabled — a trust-store completion, not a validation bypass.
- Listing evidence never contributes quantities; the two reviewed Bathinda records still contribute exactly 27 known units, and confirmed-delivery views remain empty.

## Not yet implemented (researched)

- **TNMSC** (Tamil Nadu): tender notification list with native references, PDF downloads and year archives exists at `tnmsc.tn.gov.in/html/tenders.php`; header-less table layout needs its own parser — next batch.
- **NIMS Hyderabad**: detail links use per-tender encoded ids from a listing page that returns 404 to direct requests — needs source-specific review.
- **NIMHANS Bengaluru**: tender path not found in the first pass — next batch.
- Kerala already collects via KMSCL; Karnataka/other southern state portals remain registered NIC targets.

## Validation

All **331 automated tests pass** (9 new South regressions covering CPPP-format identity grouping, trilingual titles, GeM/native references, compact rows, explicit date semantics, strict pagination and state attribution). Production builds, TypeScript and formatting checks pass; live collection ran against all three publishers.
