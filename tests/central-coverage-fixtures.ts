// SYNTHETIC fixtures model observed public layouts; never baseline data.
export const bhopalSection = (
  heading: string,
  headers: string[],
  rows: string,
) =>
  `<div><strong>${heading}</strong><table class="table table-bordered"><tr>${headers.map((h) => `<td>${h}</td>`).join("")}</tr>${rows}</table></div>`;
const manualHeaders = [
  "T.No.",
  "Tender ID",
  "Tender Title",
  "Published Date",
  "Closing",
  "Corrigendum",
  "Download",
];
const eTenderHeaders = [
  "T.No.",
  "Tender Title",
  "Published",
  "Closing",
  "Corrigendum",
  "Download",
  "Apply",
  "NOA",
];
const eoiHeaders = [
  "T.No.",
  "EOI ID",
  "Tender Title",
  "Published",
  "Closing",
  "Corrigendum",
  "Download",
];
const niqHeaders = [
  "S.No.",
  "NIQ Id",
  "NIQ Title",
  "Published",
  "Sale closing",
  "Corrigendum",
  "Download",
];
export const bhopalManualRow = (
  reference = "AIIMS/BPL/CS/2026-27/ENT/PAC/D&SS/1103",
  title = "SYNTHETIC Procurement of Cystoscopy Telescope",
  published = "25-Sep-2026",
  closing = "08-Oct-2026",
  corrigendum = "",
  file = "/AIIMSFiles/procurement/manualTender/original.pdf",
) =>
  `<tr><td>1</td><td>${reference}</td><td>${title}</td><td>${published}</td><td>${closing}</td><td>${corrigendum ? `<a href="${corrigendum}">Extension</a>` : ""}</td><td><a href="${file}">Download</a></td></tr>`;
export const bhopalETenderRow = (
  title = "SYNTHETIC GeM Bid : GEM/2026/B/7574770 Procurement of Patient Monitors",
  published = "27-May-2026",
  closing = "17-Jun-2026",
  file = "/AIIMSFiles/procurement/medicalCollegeTender/gem.pdf",
) =>
  `<tr><td>1</td><td>${title}</td><td>${published}</td><td>${closing}</td><td></td><td><a href="${file}">Download</a></td><td><a href="https://eprocure.gov.in">Apply</a></td><td><a href="/AIIMSFiles/noa.pdf">NOA</a></td></tr>`;
export const bhopalNiqRow = (
  reference = "AIIMS/CENTRAL_STORES/LPC/2026-27/1100",
  title = "SYNTHETIC Invitation of Quotation For Consumables",
  published = "19-Oct-2026",
  closing = "23-Oct-2026",
) =>
  `<tr><td>1</td><td>${reference}</td><td>${title}</td><td>${published}</td><td>${closing}</td><td></td><td><a href="/AIIMSFiles/niq.pdf">Download</a></td></tr>`;
export const bhopalPage = (extraManualRows = "") =>
  bhopalSection(
    "Manual Tender",
    manualHeaders,
    bhopalManualRow() + extraManualRows,
  ) +
  bhopalSection(
    "E-Tenders (Medical College)",
    eTenderHeaders,
    bhopalETenderRow(),
  ) +
  bhopalSection("E-Tenders (Hospital)", eTenderHeaders, "") +
  bhopalSection("Expression of Interest", eoiHeaders, "") +
  bhopalSection("Medical College Quotation", niqHeaders, "") +
  bhopalSection("Hospital Quotation", niqHeaders, bhopalNiqRow()) +
  bhopalSection(
    "E-Tenders (Engineering)",
    eTenderHeaders,
    `<tr><td>1</td><td>SYNTHETIC Development of playground area</td><td>14-Oct-2026</td><td>Please refer CPP Portal</td><td></td><td><a href="/AIIMSFiles/eng.pdf">Download</a></td><td></td><td></td></tr>`,
  ) +
  bhopalSection("HLL TENDERS", ["S.No.", "Vendor Name", "Document"], "");
export const cgmsclRow = (
  title = "Bid Number GEM 2026 B 8053870- Ayush 10 bedded Hospital Manendragarh",
  detail = "/cgmscl/Home/AttachmentList.aspx?a=202610000002",
) =>
  `<tr onClick="javascript:window.location='&#39;${detail}&#39;';" style="cursor:pointer;"><td>1</td><td><img src="../images_newGIF/newarrow.gif"/></td><td><span id="x_lblcat">${title}</span></td><td align="center"><span id="x_lblreg" style="color:Blue;">Open</span></td></tr>`;
export const cgmsclTable = (rows = cgmsclRow()) =>
  `<table><tr><th scope="col">S.No</th><th scope="col">&nbsp;</th><th align="left" scope="col">Tender Ref.</th><th align="center" scope="col">Attachments</th></tr>${rows}</table>`;
export const mglRow = (
  tenderId = "2026_AIMSM_931310_1",
  title = "SYNTHETIC Supply of Consumables for Orthosis and Prosthesis on Rate Contract basis",
  file = "/wp-content/uploads/2026/10/original.pdf",
  published = "22-10-2026",
) =>
  `<tr><td>1</td><td>CPPP</td><td>Non-PAC</td><td>${tenderId}</td><td><a href="#" target="_blank"><span class="eng">${title}</span><span class="hi">${title} हिंदी</span><span class="tel">${title} తెలుగు</span></a></td><td><a href="${file}">Document</a></td><td>${published}</td><td>&nbsp;</td><td>${published}</td><td>No</td><td></td></tr>`;
export const mglTable = (rows = mglRow()) =>
  `<table><tr><th>Sl No.</th><th>Category</th><th>Sub-Category</th><th>Tender ID</th><th>Title</th><th>Document</th><th>Publish Date</th><th>Corrigendum</th><th>Updated Date</th><th>Awarded</th><th>Purchase Order</th></tr>${rows}</table>`;
export const bibRow = (
  reference = "GEM/2026/B/8172402",
  title = "SYNTHETIC Integrated Electrosurgical Unit and vessel sealer",
  file = "pdf/Tender-Notifications/original.pdf",
  start = "23-10-2026",
  end = "07-11-2026",
) =>
  `<tr><td width="30"><p>658</p></td><td width="120"><p><a href="#" target="#"><br>${reference}<br></a></p></td><td width="190"><p><a href="${file}" target="_blank">${title}</a></p></td><td width="60"><p>${start}</p></td><td width="60"><p>${end}</p></td><td><p></p></td><td><p></p></td></tr>`;
export const bibTable = (rows = bibRow()) =>
  `<table><tr><td><p><strong>S.</strong><strong> NO</strong></p></td><td><p><strong>Tender Reference</strong></p></td><td><p><strong>Tender Title</strong></p></td><td><p><strong>Start Date</strong></p></td><td><p><strong>End Date</strong></p></td><td><p><strong>Extension of Date</strong></p></td><td><p><strong>Remarks</strong></p></td></tr>${rows}</table>`;
export const jipmerRow = (
  title = "SYNTHETIC Limited Tender for supply of Reagents and consumables",
  file = "/sites/default/files/tender.pdf",
  detail = "/limited-tender-supply-reagents",
  release = "23/10/2026 - 15:45",
  last = "25/11/2026 - 15:00",
) =>
  `<tr><td>1</td><td><a href="${detail}">${title}</a></td><td><a href="${file}">Download (2.15 MB)</a></td><td>-</td><td>${release}</td><td>${last}</td></tr>`;
export const jipmerTable = (rows = jipmerRow()) =>
  `<table><tr><th>S. No.</th><th>Title</th><th>Downloads</th><th>Tender Notice</th><th>Date of Release</th><th>Last Date</th></tr>${rows}</table>`;
