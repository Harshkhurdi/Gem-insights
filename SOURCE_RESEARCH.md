# Source access investigation

Verified 19 October 2026. This report describes tested capabilities, not permission to scrape or a claim of complete collection.

## Official GeM

- Public listing: https://bidplus.gem.gov.in/all-bids — direct HTTP GET returned **200**. HTML exposes pagination/search UI and references an `all-bids-data` browser endpoint with CSRF handling. That endpoint is **undocumented**, not a verified official public API; this application does not call it.
- Advanced search: https://bidplus.gem.gov.in/advance-search — **200**. A publicly reachable interface is not evidence of authorization for bulk collection.
- robots.txt: https://bidplus.gem.gov.in/robots.txt — **200**. Disallows `/resources/` and three BG service routes. A robots allowance does not grant reproduction or API rights.
- Policies: https://gem.gov.in/websitePolicies — **200**. Its copyright policy requires advance written permission for partial/full reproduction of website contents, accurate reproduction and source acknowledgment; third-party rights require the holder's authorization. No blanket bulk collection or commercial republication right was verified.
- Terms link: https://gem.gov.in/termsCondition — **200**; no machine-readable public bid API authorization established.
- Some research-browser requests timed out; direct HTTP could reach the public pages. Availability and permission are separate issues.

No official public bid-data API, authorized feed credentials, all-category export, historical completeness denominator, or access grant was supplied or verified. No CAPTCHA, authentication, CSRF, rate limit or anti-bot protection is bypassed. No copied session credentials are used. Live GeM synchronization is **disabled** and returns a clear explanation.

## Real document validation dataset

Original GeM bid documents on the buyer institution's public site were read and their factual fields manually verified:

| Original GeM bid | Publication | Product / requested quantity | Institution source |
|---|---|---|---|
| GEM/2025/B/6928495 | 27 Nov 2025 | ICU ventilators, 20 pieces | https://aiimsbathinda.edu.in/images/procurements/20251127095620.pdf |
| GEM/2026/B/7096713 | 12 Jan 2026 | High-end ICU ventilators, 7 pieces | https://aiimsbathinda.edu.in/images/procurements/20260112055450.pdf |

`data/verified-bids.json` contains only these two records, their source URLs, page references and limitations. It is opt-in, never seeded as fictional market activity. Values remain null. Document closing dates are original observations; later amendments and present award/status have not been established, so source status is `unknown`. Their buyer is AIIMS Bathinda, Punjab. The consignee's abbreviated address/postcode is an **inferred** state mapping, excluded from confirmed-delivery analysis. This dataset establishes **2 notices / 27 requested units / 1 institution**, not nationwide demand or confirmed purchases.

Factual source verification is not a reusable license for bulk republication of the underlying documents. The application stores document links and short field evidence, not republished PDFs. Operators must have rights for imported datasets.

## Working ingestion route

CSV and JSON imports work end to end, including an audited database import of the records above. Administrators attest authorization and supply provenance. A separate persistent worker processes jobs. A generic HTTPS JSON feed connector is available only when an operator configures `AUTHORIZED_FEED_URL` and `FEED_AUTHORIZED=true`; it has not been verified against an actual authorized GeM feed. Its contract is documented in README.

## Geographic boundaries

36 state/UT features from the LGD 2024 state snapshot distributed by [bharatlas](https://bharatlas.com/view/gb_adm1), download https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/admin/states/LGD_States.geojson . Provider states CC0-1.0 / CC-BY-4.0. Attribution is retained in the asset and interface. The included file is simplified at 0.01 degrees for dashboard rendering and normalized to current state names. Tests verify all 36 identities, spherical ring orientation and bounds. It is an administrative reference, not a surveying dataset. Provider licensing metadata and jurisdictional boundaries should be reviewed before broader commercial distribution.
