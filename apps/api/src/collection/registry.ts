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
    | null;
  buyerName?: string;
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
    "https://tenders.aiims.edu/",
    "institution",
    ["Delhi"],
  ),
  source(
    "aiims-bathinda",
    "AIIMS Bathinda",
    "https://aiimsbathinda.edu.in/",
    "institution",
    ["Punjab"],
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
  source(
    "bfuhs",
    "Baba Farid University of Health Sciences",
    "https://bfuhs.ac.in/",
    "institution",
    ["Punjab"],
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
    "https://kmscl.kerala.gov.in/",
    "institution",
    ["Kerala"],
  ),
];
export function getSource(id: string) {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error("Unknown collection source");
  return found;
}
