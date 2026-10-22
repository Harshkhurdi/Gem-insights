import { STATES } from "../../../../packages/core/domain";

export interface SourceDefinition {
  id: string;
  name: string;
  url: string;
  portal: "gem" | "cppp" | "state" | "institution";
  states: string[];
  adapter:
    | "raipur"
    | "icmr"
    | "cppp"
    | "bilaspur"
    | "hll"
    | "gmch"
    | "gmch-notices"
    | "rishikesh"
    | "kmscl"
    | "aiims-delhi"
    | "bathinda"
    | "rmsc"
    | "upums"
    | "raebareli"
    | "gorakhpur"
    | "jkmscl"
    | "jammu"
    | "nhm-ladakh"
    | "kgmu"
    | "kcgmc"
    | "s3waas"
    | "skims"
    | "bhubaneswar"
    | null;
  buyerName?: string;
  clinicalCategory?: boolean;
  scope: string;
}
const source = (
  id: string,
  name: string,
  url: string,
  portal: SourceDefinition["portal"],
  states: string[],
  adapter: SourceDefinition["adapter"] = null,
  scope = "Source listed for assisted import; automated adapter not implemented.",
): SourceDefinition => ({ id, name, url, portal, states, adapter, scope });
const statePortals: Record<string, string> = {
  "Andaman and Nicobar Islands": "https://eprocure.andaman.gov.in/nicgep/app",
  "Andhra Pradesh": "https://tender.apeprocurement.gov.in/",
  "Arunachal Pradesh": "https://arunachaltenders.gov.in/nicgep/app",
  Assam: "https://assamtenders.gov.in/nicgep/app",
  Bihar: "https://eproc2.bihar.gov.in/",
  Chandigarh: "https://etenders.chd.nic.in/nicgep/app",
  Chhattisgarh: "https://eproc.cgstate.gov.in/",
  "Dadra and Nagar Haveli and Daman and Diu":
    "https://ddtenders.gov.in/nicgep/app",
  Delhi: "https://govtprocurement.delhi.gov.in/nicgep/app",
  Goa: "https://eprocure.goa.gov.in/nicgep/app",
  Gujarat: "https://tender.nprocure.com/",
  Haryana: "https://etenders.hry.nic.in/nicgep/app",
  "Himachal Pradesh": "https://hptenders.gov.in/nicgep/app",
  "Jammu and Kashmir": "https://jktenders.gov.in/nicgep/app",
  Jharkhand: "https://jharkhandtenders.gov.in/nicgep/app",
  Karnataka: "https://kppp.karnataka.gov.in/",
  Kerala: "https://etenders.kerala.gov.in/nicgep/app",
  Ladakh: "https://tenders.ladakh.gov.in/nicgep/app",
  Lakshadweep: "https://tendersutl.gov.in/nicgep/app",
  "Madhya Pradesh": "https://mptenders.gov.in/nicgep/app",
  Maharashtra: "https://mahatenders.gov.in/nicgep/app",
  Manipur: "https://manipurtenders.gov.in/nicgep/app",
  Meghalaya: "https://meghalayatenders.gov.in/nicgep/app",
  Mizoram: "https://mizoramtenders.gov.in/nicgep/app",
  Nagaland: "https://nagalandtenders.gov.in/nicgep/app",
  Odisha: "https://tendersodisha.gov.in/nicgep/app",
  Puducherry: "https://pudutenders.gov.in/nicgep/app",
  Punjab: "https://eproc.punjab.gov.in/nicgep/app",
  Rajasthan: "https://eproc.rajasthan.gov.in/nicgep/app",
  Sikkim: "https://sikkimtender.gov.in/nicgep/app",
  "Tamil Nadu": "https://tntenders.gov.in/nicgep/app",
  Telangana: "https://tender.telangana.gov.in/",
  Tripura: "https://tripuratenders.gov.in/nicgep/app",
  "Uttar Pradesh": "https://etender.up.nic.in/nicgep/app",
  Uttarakhand: "https://uktenders.gov.in/nicgep/app",
  "West Bengal": "https://wbtenders.gov.in/nicgep/app",
};
export const SOURCES: SourceDefinition[] = [
  source(
    "gem",
    "GeM public bids",
    "https://bidplus.gem.gov.in/all-bids",
    "gem",
    [],
    null,
    "Direct collector unavailable; use authorized feed, CSV/JSON or reviewed original PDFs.",
  ),
  source(
    "cppp",
    "CPPP central public procurement",
    "https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata",
    "cppp",
    [],
    "cppp",
    "Public latest-tender listing only; not a complete archive. No item quantities on listing.",
  ),
  source(
    "cppp-states",
    "CPPP state procurement",
    "https://eprocure.gov.in/cppp/latestactivetendersnew/mmpdata",
    "state",
    [],
    "cppp",
    "Public state tender mirror; explicit state labels, unknown buyer identity; partial listing coverage.",
  ),
  source(
    "aiims-raipur",
    "AIIMS Raipur",
    "https://www.aiimsraipur.edu.in/user/tenders.php",
    "institution",
    ["Chhattisgarh"],
    "raipur",
    "Public current tender table and linked corrigenda; listing metadata only.",
  ),
  {
    ...source(
      "aiims-raipur-quotations",
      "AIIMS Raipur quotations",
      "https://www.aiimsraipur.edu.in/user/tender-procurement-through-quotations.php",
      "institution",
      ["Chhattisgarh"],
      "raipur",
      "Public quotations and linked original/corrigendum documents; partial listing coverage.",
    ),
    buyerName: "AIIMS Raipur",
  },
  source(
    "icmr",
    "ICMR and its institutes",
    "https://www.icmr.gov.in/tenders",
    "institution",
    [],
    "icmr",
    "Public tender listing; buyer institute/location must be verified per document.",
  ),
  ...STATES.map((state, i) =>
    source(
      `state-${i + 1}`,
      `${state} procurement`,
      statePortals[state],
      "state",
      [state],
    ),
  ),
  source(
    "aiims-delhi",
    "AIIMS New Delhi",
    "https://www.aiims.edu/index.php/en/tenders",
    "institution",
    ["Delhi"],
    "aiims-delhi",
    "Public current tender listing. Publishing dates are explicit; article links retain original/amendment evidence. Buyer/publisher location only; not confirmed delivery.",
  ),
  ...(
    [
      ["open", "Global/open", "global-open-tender"],
      ["proprietary", "Proprietary", "proprietary-tender"],
      ["limited", "Short-rate/limited", "short-rate-limited-enquiry"],
    ] as const
  ).map(([id, name, path]) => ({
    ...source(
      `aiims-delhi-archive-${id}`,
      `AIIMS New Delhi ${name} archive`,
      `https://www.aiims.edu/index.php/en/tenders/archive-tender/${path}`,
      "institution",
      ["Delhi"],
      "aiims-delhi",
      "Public paginated archive, including amendments. Opening Date is not verified publication; quantities and delivery locations require original review. Checkpoint resumes bounded backfill.",
    ),
    buyerName: "AIIMS New Delhi",
  })),
  ...(
    [
      ["aiims-bhubaneswar", "current tenders", "tenders"],
      ["aiims-bhubaneswar-archive", "tender archive", "tenders-archive"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `AIIMS Bhubaneswar ${label}`,
      `https://aiimsbhubaneswar.nic.in/${path}/`,
      "institution",
      ["Odisha"],
      "bhubaneswar",
      "Public current/archive tender table with explicit Publishing Date and Closing Date. Original, corrigendum, cancellation and award attachments are retained; a listing is not proof of an active bid or awarded purchase. Publisher location only; quantities require original review.",
    ),
    buyerName: "AIIMS Bhubaneswar",
  })),
  source(
    "aiims-bathinda",
    "AIIMS Bathinda",
    "https://aiimsbathinda.edu.in/Procurements.aspx?FXoLDJ=ydRRTTxkdt6Trx91pX1+cA%3D%3D&JnH7tY=ni6p7uJmUYh6NtRIoH1zej6ayg0V9vON2iB6aRQlYRo%3D",
    "institution",
    ["Punjab"],
    "bathinda",
    "Public procurement table with original and amendment attachments, including historical records. Start Date is not verified publication. Mixed procurement categories; no inferred quantities.",
  ),
  source(
    "aiims-bilaspur",
    "AIIMS Bilaspur",
    "https://www.aiimsbilaspur.edu.in/procurement/tender/gem",
    "institution",
    ["Himachal Pradesh"],
    "bilaspur",
    "Public GeM notices and linked PDFs. GeM bid identities preserved; start date is not assumed to be publication.",
  ),
  {
    ...source(
      "aiims-bilaspur-cppp",
      "AIIMS Bilaspur CPPP notices",
      "https://www.aiimsbilaspur.edu.in/procurement/tender/cppp",
      "institution",
      ["Himachal Pradesh"],
      "bilaspur",
      "Public institution-hosted CPPP notices; native references and linked PDFs.",
    ),
    buyerName: "AIIMS Bilaspur",
  },
  {
    ...source(
      "aiims-bilaspur-niq",
      "AIIMS Bilaspur quotations",
      "https://www.aiimsbilaspur.edu.in/procurement/niq",
      "institution",
      ["Himachal Pradesh"],
      "bilaspur",
      "Public quotation list; dates, original documents and amendments require review.",
    ),
    buyerName: "AIIMS Bilaspur",
  },
  source(
    "pgimer",
    "PGIMER Chandigarh",
    "https://pgimer.edu.in/",
    "institution",
    ["Chandigarh"],
  ),
  ...(
    [
      ["aiims-rishikesh", "AIIMS Rishikesh current tenders", "2525"],
      ["aiims-rishikesh-archive", "AIIMS Rishikesh archived tenders", "2529"],
      ["aiims-rishikesh-quotations", "AIIMS Rishikesh quotations", "2533"],
    ] as const
  ).map(([id, name, page]) => ({
    ...source(
      id,
      name,
      `https://aiimsrishikesh.edu.in/a1_1/?page_id=${page}`,
      "institution",
      ["Uttarakhand"],
      "rishikesh",
      "Public tender/quotation listing and original/amendment attachments. Start date is not verified publication; historical links can be broken. Coverage remains partial.",
    ),
    buyerName: "AIIMS Rishikesh",
  })),
  source(
    "gmch32",
    "GMCH Chandigarh",
    "https://gmch.gov.in/tenders",
    "institution",
    ["Chandigarh"],
    "gmch",
    "Public tender table; an explicit empty state is recorded as an empty listing, not national coverage.",
  ),
  {
    ...source(
      "gmch32-proprietary",
      "GMCH Chandigarh procurement notices",
      "https://gmch.gov.in/notices-for-procurement-of-proprietary-items",
      "institution",
      ["Chandigarh"],
      "gmch-notices",
      "Public proprietary/quotation/EOI document links; dates and native reference stay unknown unless explicit.",
    ),
    buyerName: "GMCH Chandigarh",
  },
  ...(
    [
      ["aiims-jammu", "public tenders", "tenders-new"],
      ["aiims-jammu-open", "older open tenders", "open-tenders"],
      ["aiims-jammu-quotations", "quotations and objections", "all-quotations"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `AIIMS Jammu ${label}`,
      `https://www.aiimsjammu.edu.in/${path}/`,
      "institution",
      ["Jammu and Kashmir"],
      "jammu",
      "Public original and amendment links. Upload Date is not verified publication; no inferred quantities or delivery locations. Current and older pages can overlap.",
    ),
    buyerName: "AIIMS Jammu",
  })),
  ...(
    [
      ["skims-imports", "Imports", "51-materials-management-imports"],
      ["skims-purchase1", "Purchase I", "52-materials-management-purchase-i"],
      ["skims-purchase2", "Purchase II", "56-materials-management-purchase-ii"],
      ["skims-quotations", "Quotations", "114-quotations"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `SKIMS Srinagar — ${label}`,
      `https://www.skims.ac.in/index.php/tenders/${path}.html`,
      "institution",
      ["Jammu and Kashmir"],
      "skims",
      "Public paginated procurement article list. Hits are page views, not quantities. Original article links are retained; dates, items and attachments require source review. Bounded backfill resumes from checkpoint.",
    ),
    buyerName: "SKIMS Srinagar",
  })),
  source(
    "nhm-ladakh",
    "National Health Mission Ladakh",
    "https://www.nhmladakh.in/",
    "institution",
    ["Ladakh"],
    "nhm-ladakh",
    "Procurement-labelled PDF links in the public notice marquee only; recruitment and app links are excluded. Partial homepage history, with unknown publication/closing dates and quantities.",
  ),
  source(
    "kgmu",
    "King George's Medical University",
    "https://www.kgmu.org/tenders.php",
    "institution",
    ["Uttar Pradesh"],
    "kgmu",
    "Public tender table and official references. Submission date range establishes closing date only; its start is not verified publication. Original PDFs retained, with unknown item quantities. The source intermittently returned a connection-error page during validation; failures remain visible and earlier evidence is retained.",
  ),
  ...(
    [
      ["kcgmc", "tenders", "Tender"],
      ["kcgmc-archive", "archive", "TenderArchive"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `Kalpana Chawla Government Medical College — ${label}`,
      `https://www.kcgmc.edu.in/Tender/${path}`,
      "institution",
      ["Haryana"],
      "kcgmc",
      "Public tender table and original PDF-viewer links. Opening Date is not publication; explicit closing dates retained. Mixed procurement; missing originals remain linked to the listing. Publisher location only.",
    ),
    buyerName: "Kalpana Chawla Government Medical College",
  })),
  source(
    "haryana-health",
    "Health Department Haryana",
    "https://haryanahealth.gov.in/notice-category/tenders/",
    "institution",
    ["Haryana"],
    "s3waas",
    "Current public tender notices with official CDN attachments. Generic Start/End dates are not verified publication/submission deadlines. The archive contains apparent template/demo entries and is not collected.",
  ),
  source(
    "jkmscl",
    "Jammu and Kashmir Medical Supplies Corporation",
    "https://jkmsclbusiness.com/tender.php",
    "institution",
    ["Jammu and Kashmir"],
    "jkmscl",
    "Corporation public tender/notice list and linked older archive. Row-spanned references, notice types and original documents retained. Closing Date is a listing claim; publication dates and item quantities remain unknown. Amendments and evaluation notices are not all open bids.",
  ),
  ...(
    [
      ["aiims-raebareli", "current tenders", "current/tenders"],
      ["aiims-raebareli-archive", "archived tenders", "archived/tenders"],
      ["aiims-raebareli-quotations", "current quotations", "current/quotation"],
      [
        "aiims-raebareli-quotations-archive",
        "archived quotations",
        "archived/quotation",
      ],
      ["aiims-raebareli-pac", "PAC notices", "current/pac"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `AIIMS Raebareli — ${label}`,
      `https://aiimsrbl.edu.in/${path}`,
      "institution",
      ["Uttar Pradesh"],
      "raebareli",
      "Public procurement cards with explicit references and original PDF download routes. Only labelled publication/closing dates are asserted; PAC objection windows are not bid dates. Bounded archive backfill; published sidebar totals do not prove collected counts.",
    ),
    buyerName: "AIIMS Raebareli",
  })),
  ...(
    [
      ["aiims-gorakhpur", "current tenders", "tenders"],
      ["aiims-gorakhpur-quotations", "current quotations", "quotation"],
      [
        "aiims-gorakhpur-quotations-archive",
        "archived quotations",
        "archived-quotations",
      ],
      ["aiims-gorakhpur-pac", "PAC notices", "pac"],
    ] as const
  ).map(([id, label, path]) => ({
    ...source(
      id,
      `AIIMS Gorakhpur — ${label}`,
      `https://aiimsgorakhpur.edu.in/${path}/`,
      "institution",
      ["Uttar Pradesh"],
      "gorakhpur",
      "Public procurement table and original attachments, including mixed works/services and amendments. Generic Start/End listing dates do not establish original bid dates. PDF paths can be reused; title context is retained. Browser-only table pagination is already present in the downloaded HTML.",
    ),
    buyerName: "AIIMS Gorakhpur",
  })),
  ...(
    [
      ["uttarakhand-health", "current tenders", "notice-category/tenders"],
      [
        "uttarakhand-health-archive",
        "archived tenders",
        "past-notices/tenders",
      ],
    ] as const
  ).map(([id, label, path]) =>
    source(
      id,
      `Uttarakhand Health Department — ${label}`,
      `https://health.uk.gov.in/${path}/`,
      "institution",
      ["Uttarakhand"],
      "s3waas",
      "Public health department procurement listing. The publisher explicitly reported no matching notices on 22 October 2026; this is an empty observed listing, not zero statewide demand or complete coverage. Future unfamiliar layouts fail visibly.",
    ),
  ),
  source(
    "phsc",
    "Punjab Health Systems Corporation",
    "https://phsc.punjab.gov.in/",
    "institution",
    ["Punjab"],
    null,
    "Northern priority target. Public homepage returned HTTP 503 on 22 October 2026; procurement listing access/layout requires validation before enabling collection.",
  ),
  source(
    "safdarjung",
    "VMMC and Safdarjung Hospital",
    "https://vmmc-sjh.mohfw.gov.in/tenders",
    "institution",
    ["Delhi"],
    null,
    "Public current/archive pages reached on 22 October 2026. Mixed tenders, awards, disposal auctions and procured-equipment reports require lifecycle separation before using them as requested-demand signals; automatic collection remains disabled.",
  ),
  source(
    "aiims-gorakhpur-archive",
    "AIIMS Gorakhpur archived tenders",
    "https://aiimsgorakhpur.edu.in/archived-tenders/",
    "institution",
    ["Uttar Pradesh"],
    null,
    "Public archive page reached but contained no procurement table and no explicit no-notices state on 22 October 2026. It is not counted as a successful empty collection; current tenders and quotation archives are separate profiles.",
  ),
  source(
    "sgpgims",
    "Sanjay Gandhi Postgraduate Institute of Medical Sciences",
    "https://www.sgpgims.org.in/Home/Tender.html",
    "institution",
    ["Uttar Pradesh"],
    null,
    "Priority northern target; official tender listing returned HTTP 503 on 22 October 2026. Not enabled as a working collector; KGMU/UPUMS remain separate partial coverage.",
  ),
  source(
    "rmlh",
    "Dr Ram Manohar Lohia Hospital",
    "https://www.rmlh.mohfw.gov.in/Index1.aspx?langid=1&lev=2&lid=1243&lsid=2258&pid=2257",
    "institution",
    ["Delhi"],
    null,
    "Priority northern target; official tender listing returned HTTP 503 on 22 October 2026. Assisted source review remains available.",
  ),
  source(
    "igmc-shimla",
    "Indira Gandhi Medical College Shimla",
    "https://www.igmcshimla.edu.in/",
    "institution",
    ["Himachal Pradesh"],
    null,
    "Priority northern target; official source identified. Homepage returned HTTP 503 on 22 October 2026; procurement listing still requires access/layout validation. AIIMS Bilaspur is separate partial coverage.",
  ),
  source(
    "hmscl",
    "Haryana Medical Services Corporation",
    "https://hmscl.org.in/",
    "institution",
    ["Haryana"],
    null,
    "Priority northern target; public request returned HTTP 503 on 22 October 2026. Automated collection not enabled; Haryana health/KCGMC profiles provide separate partial coverage.",
  ),
  source(
    "uhsr",
    "University of Health Sciences Rohtak",
    "https://www.uhsr.ac.in/quotations",
    "institution",
    ["Haryana"],
    null,
    "Priority northern target; official quotation page returned HTTP 503 on 22 October 2026. Assisted import/source review remains available.",
  ),
  source(
    "aiims-jodhpur",
    "AIIMS Jodhpur",
    "https://aiimsjodhpur.edu.in/tenders.php",
    "institution",
    ["Rajasthan"],
    null,
    "Priority northern target; official listing found but returned HTTP 503 on 22 October 2026. Not enabled as a working collector; RMSC is separate partial coverage.",
  ),
  source(
    "bfuhs",
    "Baba Farid University of Health Sciences",
    "https://www.bfuhs.ac.in/tender/tender.asp",
    "institution",
    ["Punjab"],
    null,
    "Priority northern target; public tender page returned HTTP 503 on 22 October 2026. Automated collection not enabled; AIIMS Bathinda is separate partial coverage.",
  ),
  source(
    "esic",
    "Employees State Insurance Corporation",
    "https://www.esic.gov.in/tenders",
    "institution",
    [],
  ),
  source("jipmer", "JIPMER", "https://jipmer.edu.in/", "institution", [
    "Puducherry",
  ]),
  source(
    "hll",
    "HLL Lifecare",
    "https://www.lifecarehll.com/tender",
    "institution",
    [],
    "hll",
    "Public HLL tender listing and published pagination; delivery states are not inferred from titles.",
  ),
  source(
    "hites",
    "HLL Infra Tech Services",
    "https://hllhites.com/",
    "institution",
    [],
  ),
  source(
    "tnmsc",
    "Tamil Nadu Medical Services Corporation",
    "https://www.tnmsc.tn.gov.in/",
    "institution",
    ["Tamil Nadu"],
  ),
  source(
    "kmscl",
    "Kerala Medical Services Corporation",
    "https://kmscl.kerala.gov.in/KMSCL/index.php/ckmscl/menucontentview/60",
    "institution",
    ["Kerala"],
    "kmscl",
    "Public notices include equipment, amendments, evaluation/price-opening and running-contract notices. Native references, dates and quantities require original review; these are not all open tenders.",
  ),
  ...(
    [
      [
        "rmsc-equipment",
        "Equipment and instruments",
        "Equipment-Instrument-Tenders",
        false,
      ],
      ["rmsc-drugs", "Drug and surgical notices", "Drug-Tenders", true],
    ] as const
  ).map(([id, label, path, clinicalCategory]) => ({
    ...source(
      id,
      `Rajasthan Medical Services Corporation — ${label}`,
      `https://rmsc.health.rajasthan.gov.in/content/raj/medical/rajasthan-medical-services-corporation-ltd-/en/Tenders/${path}.html`,
      "institution",
      ["Rajasthan"],
      "rmsc",
      "Public tender/notice table, including originals, amendments, evaluations and historical notices. Name and description are retained together. From/To and Upload Date do not establish original publication or bid closing; dates and quantities require original review.",
    ),
    buyerName: "Rajasthan Medical Services Corporation",
    clinicalCategory,
  })),
  source(
    "upums",
    "Uttar Pradesh University of Medical Sciences",
    "https://www.upums.ac.in/tender",
    "institution",
    ["Uttar Pradesh"],
    "upums",
    "Public tender table with explicit Published Date and original attachments. Mixed clinical, equipment and other procurement; closing dates, quantities and delivery locations require original review.",
  ),
];
export function getSource(id: string) {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error("Unknown collection source");
  return found;
}
