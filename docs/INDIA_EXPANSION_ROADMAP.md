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

## Phase 2 — Central India (next)

Madhya Pradesh and Chhattisgarh. Known targets: AIIMS Bhopal, MP health procurement, state portals (`mptenders`), Chhattisgarh health agencies; AIIMS Raipur already implemented. Not started.

## Phase 3 — South India

Karnataka, Tamil Nadu, Kerala, Andhra Pradesh, Telangana, Puducherry. Known targets: NIMHANS, TNMSC (registered), KMSCL (implemented), AIIMS Mangalagiri, AIIMS Bibinagar, NIMS, JIPMER (registered). Not started.

## Phase 4 — East, West, Northeast, remaining UTs

AIIMS Bhubaneswar (Odisha) already implemented. Maharashtra, Gujarat, Goa, DNH&DD, West Bengal, Bihar, Jharkhand and the eight northeastern states plus A&N Islands and Lakshadweep are registered only as state portals. Not started.

## Phase 5 — All-India integration

Regional scheduling beyond `north`, national rankings/map/institution intelligence improvements. Not started.

## Milestone log

| Date | Milestone | Tests |
| --- | --- | ---: |
| 2026-10-22 | Raebareli/Gorakhpur/Uttarakhand expansion (49 profiles, 16,656-observation baseline) | 298 |
| 2026-10-23 | Source recovery: AIIMS Jodhpur, SGPGIMS, PHSC ×2, HMSCL; PGIMER recheck documented (54 profiles, 102 targets) | 313 |
