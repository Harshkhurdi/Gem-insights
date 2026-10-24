# Northeast India collection — Meghalaya

The Northeast rollout begins with the Meghalaya Health and Family Welfare Department, taking the registry to **66 automated public listings and 119 registered targets**. Research date: 24 October 2026.

| Source | Profile | First live run (24 Oct 2026) |
| --- | --- | ---: |
| Meghalaya HFW tender notices | `meghealth` | 57 observations (34 medical) |

## Meghalaya

- The public tender notice list pairs printed notice titles with linked original PDFs and a single Date column the publisher does not document; that column is never asserted as a publication or closing date.
- Cancellation, supply/installation and hospital notices are retained with their printed titles; item quantities require original review.

## Not yet implemented (researched)

- **Assam NHM**: its procurement page publishes purchase orders (supplier, item, order value) — award-side records, not requested-demand evidence; registering it would mix lifecycle stages, so it stays out of collection pending a requested-demand listing.
- **Mizoram HFW**: the tenders page is an unstructured attachment list.
- **Arunachal Pradesh, Manipur, Meghalaya's NIC mirror, Nagaland, Sikkim, Tripura, A&N Islands, Lakshadweep**: state health/NHM sites were unreachable from this environment on 24 October 2026 (connection failures); NIC state portals remain registered targets.
- **AIIMS Guwahati**: no public tender listing exposed on the homepage this pass.

## Validation

All **337 automated tests pass** (1 new Northeast regression covering Meghalaya title/document identity, unasserted undocumented dates and layout guards), with production builds, TypeScript and formatting checks. Live collection ran against Meghalaya.
