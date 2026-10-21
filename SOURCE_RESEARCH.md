Current source expansion: see [NATIONAL_COLLECTION_EXPANSION.md](docs/NATIONAL_COLLECTION_EXPANSION.md) for the 11 implemented public listing profiles and the linked-document workflow. Earlier three-profile counts below are historical.

# Current collection implementation

The new [local collection guide](docs/LOCAL_COLLECTION.md) supersedes the earlier no-collector status below for three public metadata listings: AIIMS Raipur, ICMR and CPPP central active tenders. Native tender references and a review queue are supported. GeM direct access and nationwide coverage remain unimplemented. The earlier investigation is retained as historical context.

# Source access investigation

Phase 3 follow-up: see the [source capability matrix](docs/SOURCE_CAPABILITIES.md). Official GeM enquiry routes were rechecked, CPPP/Punjab ownership/reproduction policies inspected, and data.gov.in resource licensing investigated. No suitable authorized line-item feed, reusable original-PDF corpus or access grant was established. Retrieved OGD pages included a sandbox/incomplete-data warning. No collector was enabled; actual new original corpus remains zero and the current target is 50. The revised request remains unsent.

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

## Phase 2: corpus rights and legitimate access opportunities

Investigated 19 October 2026. No bulk collection, API enrollment or access agreement was completed. No protected endpoint was used and no document URL fetcher was added.

| Candidate source / route | Verified finding | Permission / coverage status | Next authorized step |
|---|---|---|---|
| [Official GeM help desk/contact](https://gem.gov.in/contactUs) | Public contact page and support-ticket route available | Enquiry route only; no data license or completeness guarantee | Operator sends the prepared request and seeks written scope |
| [GeM Integration Toolkit enquiry](https://gem.gov.in/home/dwn/user_info/ifms) | Official non-registered-user route requests name, email, mobile and organization | Not submitted; toolkit purpose is not evidence of a bulk bid API | Ask whether a research/commercial tender feed is available and what licensing applies |
| [GeM institutional MoUs](https://gem.gov.in/mou) | Official page lists state/UT arrangements | Does not grant this project access under those agreements | Request an appropriate pilot/data-sharing arrangement directly |
| AIIMS Bathinda public procurement references already recorded above | Two historical bid documents have reviewed factual reference fields | No new reusable original-PDF corpus permission was supplied | Operator obtains permitted originals and records rights per batch |
| [AIIMS website policy](https://tenders.aiims.edu/index.php/en/disclaimer?id=6921), [JIPMER website policy](https://jipmer.ac.in/website-policy) | Policy pages identified; full current pages could not be retrieved reliably during this phase | Rights remain unverified; no blanket permission inferred for GeM-authored third-party documents | Confirm actual document owner and processing/retention terms before including originals |

**Actual newly authorized original-PDF golden corpus: 0 documents.** The two legacy factual metadata references are not counted as extracted original-PDF gold examples. No 25-document or national dataset claim is made. Synthetic regression PDFs remain isolated tests. [Corpus manifest](data/golden-corpus.json) records the exact status; [access request](docs/GEM_DATA_ACCESS_REQUEST.md) is a draft for the operator and has not been sent.
