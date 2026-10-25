# India expansion roadmap

Progress tracker for the nationwide rollout: **North → Central → South → East/West/Northeast → All India**. Statuses are backed by the source registry and database, not just this document. Last updated: 23 October 2026.

Status vocabulary: **Implemented** (automated collector validated against the live publisher), **Empty-listed** (collector validated; publisher currently reports no matching notices), **Assisted** (registered target; automated collection not possible yet), **Blocked** (unreachable in the latest recheck), **Not investigated**.

## Phase 1 — North India (active)

| State/UT | Implemented profiles | Assisted/Blocked targets | Status |
| --- | --- | --- | --- |
| Delhi | AIIMS Delhi current + 3 archives; CPPP; Safdarjung notices (lifecycle-separated) | RML Hospital (connection failure) | Partial, improved 2026-10-24 |
| Punjab | AIIMS Bathinda; PHSC current + archive | BFUHS (connection failure) | Partial, improved 2026-10-23 |
| Haryana | KCGMC current/archive; Haryana Health; HMSCL equipment | UHSR Rohtak (HTTP 503) | Partial, improved 2026-10-23 |
| Chandigarh | GMCH current + proprietary notices | PGIMER (interactive-form listing) | Partial |
| Himachal Pradesh | AIIMS Bilaspur ×3 | IGMC Shimla (connection failure) | Partial |
| Uttarakhand | AIIMS Rishikesh ×3; Uttarakhand Health ×2 (explicitly empty) | — | Partial |
| Uttar Pradesh | UPUMS, KGMU, SGPGIMS; AIIMS Raebareli ×5; AIIMS Gorakhpur ×4 | Gorakhpur archived tenders (no table/empty state) | Partial, improved 2026-10-23 |
| Rajasthan | RMSC ×2; AIIMS Jodhpur | — | Partial, improved 2026-10-23 |
| Jammu & Kashmir | AIIMS Jammu ×3; JKMSCL; SKIMS ×4 | — | Partial |
| Ladakh | NHM Ladakh | — | Minimal |

National profiles: CPPP central + state mirror, ICMR, HLL. Remaining northern work: recheck blocked targets (BFUHS, IGMC, RML, UHSR, PGIMER), Safdarjung lifecycle separation, historical archive backfills.

## Phase 2 — Central India (implemented 2026-10-23)

| State | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| Madhya Pradesh | AIIMS Bhopal (1,856 obs, history to 2014) | MPPHSCL (session-bound listings); mptenders NIC portal registered | Partial |
| Chhattisgarh | AIIMS Raipur ×2 (earlier); CGMSCL equipment (989) + drugs (735) + other (208) + QC (104) | CGMSCL civil works page; state NIC portal registered | Partial, improved 2026-10-24 |

## Phase 3 — South India (started 2026-10-24)

| State/UT | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| Andhra Pradesh | AIIMS Mangalagiri (993 obs, CPPP IDs) | — | Partial, new 2026-10-24 |
| Telangana | AIIMS Bibinagar (460 obs) | NIMS (encoded detail ids) | Partial, new 2026-10-24 |
| Puducherry | JIPMER (399+ obs, archive backfilling) | — | Partial, new 2026-10-24 |
| Kerala | KMSCL (earlier) | — | Partial |
| Tamil Nadu | TNMSC notifications + FY2023-24/25/26 archives (151 obs) | second notice category (action=5) | Partial, new 2026-10-24 |
| Karnataka | — | NIMHANS (dynamic listing, currently empty to HTTP) | Not started |

## Phase 4 — East, West, Northeast, remaining UTs

### Northeast India (started 2026-10-24)

| State | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| Meghalaya | HFW tender notices (57 obs) | — | Partial, new 2026-10-24 |
| Assam | AIIMS Guwahati tender + quotation official JSON feeds (49 obs) | NHM procurement page is award-side purchase orders (excluded by design) | Partial, new 2026-10-24 |
| Mizoram | — | unstructured attachment list | Not started |
| Arunachal, Manipur, Nagaland, Sikkim, Tripura | — | unreachable 2026-10-24; NIC portals registered | Not started |

### East India (started 2026-10-24)

| State | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| West Bengal | WBMSCL archive (6,820 obs, 4,485 medical, dates to 2018) | WB Health (client-side rendering) | Partial, new 2026-10-24 |
| Bihar | — | SHS (unstructured link list, parser pending); BMSCL unreachable | Not started |
| Jharkhand | — | health-procurement sites unreachable 2026-10-24 | Not started |
| Odisha | AIIMS Bhubaneswar ×2 (earlier) | — | Partial |

### West India (started 2026-10-24)

| State/UT | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| Gujarat | GMSCL tender section (79 obs, 37 medical) | rate-contract holder list (awards, not demand) | Partial, new 2026-10-24 |
| Maharashtra | — | AIIMS Nagpur (login wall); NIC portal registered | Not started |
| Goa, DNH&DD | — | state pages unreachable 2026-10-24; NIC portals registered | Not started |

AIIMS Bhubaneswar (Odisha) already implemented. Maharashtra, Gujarat, Goa, DNH&DD, West Bengal, Bihar, Jharkhand and the eight northeastern states plus A&N Islands and Lakshadweep are registered only as state portals. Not started.

## Parallel workstream — verified extraction (2026-10-24 pilot)

A bounded pilot ran the designed notice-extraction flow end to end: six GeM-format bid documents linked on WBMSCL's own official host were queued through the operator API, downloaded with the existing safeguards (same-origin HTTPS PDFs only, 15 MiB cap, content not retained, drafts require human review), and processed locally with no external AI.

Pilot results: six drafts produced, all pinned in review status with no analytical effect until reviewed. Two documents yielded item drafts (Digital Radiography System with quantity 1); two were corrigendum documents with no BOQ section (now explained by an explicit draft warning instead of a silent empty list, and specification-parameter rows no longer leak as items); the remaining drafts reflected documents whose item sections the current rules deliberately leave for review. Real-document accuracy remains unmeasured until an authorized annotated corpus exists; operator review of the six drafts is the next step, and further extraction improvement continues from real-document feedback like this pilot.

## Phase 5 — All-India integration (scheduling shipped 2026-10-24)

Regional scheduling now supports `north`, `central`, `south`, `east`, `west`, `northeast` and `all` with full backward compatibility; regional selection covers every automated profile exactly once and keeps national feeds available in every region. National rankings/map/institution intelligence improvements remain open. The live operator configuration is unchanged (`all`); region values are opt-in via `COLLECTION_REGION` or `npm run collect -- <region>`. JKMSCL's publisher reverted to a template placeholder on 24 October 2026 — collection fails visibly and its 900+ historical observations are retained.

## Milestone log

| Date | Milestone | Tests |
| --- | --- | ---: |
| 2026-10-22 | Raebareli/Gorakhpur/Uttarakhand expansion (49 profiles, 16,656-observation baseline) | 298 |
| 2026-10-23 | Source recovery: AIIMS Jodhpur, SGPGIMS, PHSC ×2, HMSCL; PGIMER recheck documented (54 profiles, 102 targets) | 313 |
| 2026-10-23 | Central India: AIIMS Bhopal + CGMSCL equipment + cystoscope family; MPPHSCL registered assisted (56 profiles, 105 targets) | 322 |
| 2026-10-24 | South India batch 1: AIIMS Mangalagiri + AIIMS Bibinagar + JIPMER with TLS chain completion (59 profiles, 107 targets) | 331 |
| 2026-10-24 | South India batch 2: TNMSC notifications + 3 year archives; NIMHANS/NIMS registered assisted (63 profiles, 112 targets) | 333 |
| 2026-10-24 | West India: GMSCL Gujarat + AIIMS Nagpur assisted; innermost-table selection fix (64 profiles, 114 targets) | 335 |
| 2026-10-24 | East India: WBMSCL archive (6,820 obs); WB Health + Bihar SHS assisted (65 profiles, 117 targets) | 336 |
| 2026-10-24 | Northeast: Meghalaya HFW (57 obs); Assam NHM documented as award-side exclusion (66 profiles, 119 targets) | 337 |
| 2026-10-24 | All-India regional scheduling: seven region values with backward compatibility (five scheduling regressions) | 342 |
| 2026-10-24 | Overview collection-health strip + last-7-days KPI; Safdarjung lifecycle separation resolves its documented blocker (67 profiles, 118 targets) | 345 |
| 2026-10-24 | Coverage extensions: AIIMS Guwahati official JSON feed + CGMSCL drug category; blocked-target recheck (BFUHS/IGMC/RMLH/UHSR unchanged) (69 profiles, 120 targets) | 347 |
| 2026-10-24 | Extraction pilot: 6 WBMSCL GeM PDFs through the review flow; corrigendum warning + spec-row leak fixes from real-document feedback | 349 |
| 2026-10-24 | Health-check fixes: Raipur pre-establishment dates unasserted (5 rows corrected), CLI region resolution fixed and live-verified, JKMSCL paused after publisher reversion | 351 |
| 2026-10-24 | Expansion: Guwahati quotation feed + CGMSCL other/QC (wide six-column layout with explicit publish dates); region-health panel on Data Coverage (72 profiles, 123 targets) | 354 |
| 2026-10-24 | Operator review completed: 2 verified approvals (GEM/2026/B/7898310, GEM/2026/B/8095901 — 1 Digital Radiography System each, WBMSCL), 4 corrigendum rejections with documented verification; verified dataset now 4 tenders / 29 units; favicon added | 354 |
