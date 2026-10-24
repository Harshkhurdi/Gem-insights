# West India collection — GMSCL Gujarat

The West rollout begins with the Gujarat Medical Services Corporation, taking the registry to **64 automated public listings and 114 registered targets**. Research date: 24 October 2026.

| Source | Profile | First live run (24 Oct 2026) |
| --- | --- | ---: |
| GMSCL tender section | `gmscl` | 79 observations (37 medical, all with listed closing dates) |
| AIIMS Nagpur | `aiims-nagpur` (assisted) | Tender route requires account login |

## GMSCL

- The public tender table carries explicit native `T.E.NO.GMSCL/…` references, category labels (drug, diagnostic, equipment procurement, medical device and others), explicit Start/Closing dates and linked original documents; the All-Documents column keeps notice/schedule attachments.
- Start Date is a generic listing field and is never asserted as publication; Closing Date is the publisher's listed closing claim. Item quantities require original review.
- The page wraps its data table inside layout container tables; collection selects the innermost matching table while keeping publishers whose nested tables are amendment attachments rather than separate tables.
- The publisher's rate-contract holder list (awarded vendors and prices) is a separate page and is deliberately not collected as requested demand.

## Not yet implemented (researched)

- **AIIMS Nagpur**: the tender route serves a login wall to direct requests. Registered assisted; the Maharashtra NIC portal remains the registered statewide fallback.
- **Goa and Dadra & Nagar Haveli and Daman & Diu**: state health tender pages were unreachable from this environment on 24 October 2026 (connection failures); the NIC state portals remain registered targets.
- Maharashtra HFW portals were also unreachable this pass; NIC Maharashtra is the registered target.

## Validation

All **335 automated tests pass** (2 new West regressions covering GMSCL reference/category/document handling, closing-only date semantics and layout guards), with production builds, TypeScript and formatting checks. Live collection ran against GMSCL; rows enter the main insights immediately with listing evidence and unknown quantities.
