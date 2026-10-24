# East India collection — WBMSCL

The East rollout begins with the West Bengal Medical Services Corporation, taking the registry to **65 automated public listings and 117 registered targets**. Research date: 24 October 2026.

| Source | Profile | First live run (24 Oct 2026) |
| --- | --- | ---: |
| WBMSCL tender archive | `wbmscl` | 6,820 observations (4,485 medical; publication dates back to January 2018) |
| WB Health & FW Department | `wb-health` (assisted) | Listing renders client-side; loading state to direct HTTP |
| Bihar State Health Society | `bihar-shs` (assisted) | Unstructured notice/PDF link list; dedicated parser required |

## WBMSCL

- One public table of 7,167 rows carries native `WBMSCL/NIT-…` references, descriptions, original documents and explicit PUBLISH DATE values (weekday-prefixed; the weekday is stripped, the date itself is asserted).
- The publisher's header row is rendered in data cells; detection reads the first row, and the identity columns are located by their published labels.
- Mixed procurement including works and services; item quantities require original review. References are kept as printed apart from slash-adjacent spacing.
- Bihar SHS, BMSCL and Jharkhand health-procurement sites were unreachable or unstructured this pass; AIIMS Bhubaneswar continues to cover Odisha from earlier work.

## Validation

All **336 automated tests pass** (1 new East regression covering WBMSCL references, weekday-stripped explicit publication dates, document identity and layout guards), with production builds, TypeScript and formatting checks. Live collection ran against WBMSCL.
