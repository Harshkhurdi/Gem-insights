# India expansion roadmap

Progress tracker for the nationwide rollout: **North → Central → South → East/West/Northeast → All India**. Statuses are backed by the source registry and database, not just this document. Last updated: 23 October 2026.

Status vocabulary: **Implemented** (automated collector validated against the live publisher), **Empty-listed** (collector validated; publisher currently reports no matching notices), **Assisted** (registered target; automated collection not possible yet), **Blocked** (unreachable in the latest recheck), **Not investigated**.

## Phase 1 — North India (active)

| State/UT | Implemented profiles | Assisted/Blocked targets | Status |
| --- | --- | --- | --- |
| Delhi | AIIMS Delhi current + 3 archives; CPPP | RML Hospital (connection failure), Safdarjung (lifecycle separation needed) | Partial |
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
| Chhattisgarh | AIIMS Raipur ×2 (earlier); CGMSCL equipment (989 obs, 194 GeM refs) | CGMSCL drug/QC/civil/other pages (future); state NIC portal registered | Partial, improved 2026-10-23 |

## Phase 3 — South India (started 2026-10-24)

| State/UT | Implemented | Assisted/Blocked | Status |
| --- | --- | --- | --- |
| Andhra Pradesh | AIIMS Mangalagiri (993 obs, CPPP IDs) | — | Partial, new 2026-10-24 |
| Telangana | AIIMS Bibinagar (460 obs) | NIMS (encoded detail ids) | Partial, new 2026-10-24 |
| Puducherry | JIPMER (399+ obs, archive backfilling) | — | Partial, new 2026-10-24 |
| Kerala | KMSCL (earlier) | — | Partial |
| Tamil Nadu | — | TNMSC (header-less table, next batch) | Not started |
| Karnataka | — | NIMHANS (tender path unfound in first pass) | Not started |

## Phase 4 — East, West, Northeast, remaining UTs

AIIMS Bhubaneswar (Odisha) already implemented. Maharashtra, Gujarat, Goa, DNH&DD, West Bengal, Bihar, Jharkhand and the eight northeastern states plus A&N Islands and Lakshadweep are registered only as state portals. Not started.

## Phase 5 — All-India integration

Regional scheduling beyond `north`, national rankings/map/institution intelligence improvements. Not started.

## Milestone log

| Date | Milestone | Tests |
| --- | --- | ---: |
| 2026-10-22 | Raebareli/Gorakhpur/Uttarakhand expansion (49 profiles, 16,656-observation baseline) | 298 |
| 2026-10-23 | Source recovery: AIIMS Jodhpur, SGPGIMS, PHSC ×2, HMSCL; PGIMER recheck documented (54 profiles, 102 targets) | 313 |
| 2026-10-23 | Central India: AIIMS Bhopal + CGMSCL equipment + cystoscope family; MPPHSCL registered assisted (56 profiles, 105 targets) | 322 |
| 2026-10-24 | South India batch 1: AIIMS Mangalagiri + AIIMS Bibinagar + JIPMER with TLS chain completion (59 profiles, 107 targets) | 331 |
