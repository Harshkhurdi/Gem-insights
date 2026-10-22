> Latest update: [Rajasthan/UP collection](STATE_MEDICAL_COLLECTION.md) adds RMSC and UPUMS, bringing the app to 23 public-listing profiles and a 9,673-observation baseline. Counts below describe the preceding Delhi/Bathinda rollout.

# Delhi and Bathinda collection

The application now has **20 automatic public-listing profiles** and **63 registered source targets**. This update enables AIIMS New Delhi's current listing and three published archive categories, plus AIIMS Bathinda's public procurement table. Collected signals flow into the existing main insights immediately. Registered targets and archive page counts do not establish complete national coverage.

## Source behavior

| Profile | Public listing | Evidence and limits |
|---|---|---|
| AIIMS New Delhi | https://www.aiims.edu/index.php/en/tenders | Explicit Date of Publishing and Date of Closing; original detail-article URLs; GeM/CPPP references only when present in the title. |
| Delhi global/open archive | https://www.aiims.edu/index.php/en/tenders/archive-tender/global-open-tender | Published Next links and resumable offsets; includes originals and amendments. Opening Date is not treated as publication. |
| Delhi proprietary archive | https://www.aiims.edu/index.php/en/tenders/archive-tender/proprietary-tender | Same archive rules; no inference that every proprietary notice is a completed purchase. |
| Delhi short-rate/limited archive | https://www.aiims.edu/index.php/en/tenders/archive-tender/short-rate-limited-enquiry | Quotations and historical procurement notices, not a verified order book. |
| AIIMS Bathinda | Public procurement table linked through the institution's Procurement menu | Explicit references, End Date and original/amendment/BOQ attachments. Start Date is not verified publication. The public category URL is retained as published; a changed/expired route is an error, not an empty success. |

Delhi's buyer/publisher is AIIMS New Delhi, with Delhi as its institution state. Some titles concern NCI/Jhajjar and other locations; these are not silently converted into confirmed delivery destinations. Bathinda's publisher state is Punjab. Delhi titles identifying EHS beneficiaries are reduced to procurement wording before storage rather than retaining patient names/identifiers in the research dataset.

Delhi article links are kept exactly as published. An expired article can return 404 through the current-list route, so archive links must not be rewritten. Where an official GeM or CPPP reference exists, the main insights group it across sources as before. Otherwise the explicit Delhi article ID groups copies of the same article across current and archive profiles. Different articles without a reliable bid reference remain separate; unknown amendments can still overlap. No article ID becomes an invented tender reference.

Bathinda's original document is preferred over a preceding corrigendum when the link labels distinguish them. All published PDF, Word, Excel and ZIP attachments remain review links. Rows with missing originals stay visible through the official listing; their titles distinguish them during repeat scans and snapshot restore. Neither collector downloads document contents during a listing scan. Delhi's HTML detail articles require source review before their attachments/items can be extracted; no native BOQ extraction is claimed.

Archive pagination stays within the exact official category path. Only a single nonnegative `start` offset is accepted, and Next must advance. Switching category, entering a detail article, leaving the origin or rewinding fails visibly. Each normal collector job still has a 25-page budget and resumes the saved checkpoint; a fresh head read precedes resumed historical backfill. Pausing and retry behavior is unchanged.

## Clinical candidate recall

Additional broad signals cover pacemakers, dysphagia treatment, infusion supplies, neonatal probes, echocardiography, laparoscopic surgery, injections, intraocular/platelet products, patient-care supplies, blood collection/bank supplies, molecular biology kits and scrub/OT supplies. These terms improve review recall without creating new product families or inferred quantities. Candidate status does not prove equipment demand. Existing derived labels refresh during migration without resetting decisions or original observation times.

## Update locally

```sh
git pull --ff-only origin main
npm ci
npm run build -w @gem/api
npm run migrate
npm run import:discoveries
npm run dev
```

An existing installation does not need a reset. The migration enables previously unimplemented Delhi/Bathinda sources, preserves existing operator pauses, and clears a checkpoint only when that source's listing URL changes. Snapshot restore is idempotent and preserves newer local observations. Open **Tender Collection** to run or pause the new profiles. Main insights default to medical/clinical signals; use the evidence and procurement filters to inspect all collected records or reviewed item data.

## Validation

Live collection passed for all five new profiles over 17 pages: 111 current Delhi notices, 50 records from each of its three archives and 766 Bathinda records. This added 1,027 observations, expanding the baseline from 4,642 to **5,669**. The current candidate rules mark 2,614 observations as broad medical/clinical candidates before identity grouping. Each archive run stopped at its five-page validation budget with `start=50` saved; none of the archives is fully collected. All **200 distinct automated tests passed** across fresh serial validation batches, including 13 new parser/database cases. A registry assertion was updated from 15 to 20 profiles. Two HTTP worker checks exceeded their existing deadlines during a concurrent build; the isolated 27-test parser/HTTP rerun passed with the deadlines unchanged. Production API/web builds, TypeScript checks and formatting checks passed. The expanded snapshot restored 5,669 records, preserving all 5,669 observation timestamps. Repeating the import added zero duplicates and preserved a newer local observation. The compiled API returned **5,568 grouped records**, including **2,568 medical signals across 85 product families**. Product, buyer, geography, trend, explorer and listing-detail requests passed. Undated Bathinda records stayed out of publication trends; Delhi records with explicit publication dates appeared. Adding the two reviewed sample bids replaced their matching listing signals without increasing the 2,568-record medical count; the known requested quantity remained exactly 27 units. Listing-only quantities and prices stayed unknown; collection and snapshot restore created zero verified tenders. Archive backfill and nationwide collection remain incomplete. Database checks here use PGlite; native PostgreSQL concurrency and real-document extraction accuracy remain separate verification steps.
