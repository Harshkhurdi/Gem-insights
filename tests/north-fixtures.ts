export const jammuTable = (
  title = "SYNTHETIC Patient monitors",
  file = "original.pdf",
  extra = "",
) =>
  `<table><tr><th>Upload Date</th><th>Title of Tender</th><th>Download</th></tr><tr><td>20.10.2026</td><td>${title}${extra}</td><td><a href="/wp-content/uploads/2026/10/${file}">PDF</a></td></tr></table>`;
export const kgmuTable = (
  ref = "GEM/2026/B/123456",
  date = "17-10-2026 To 07-11-2026",
) =>
  `<table><tr><td>Sr. No.</td><td>Notice No.</td><td>Tenders</td><td>Submission Date</td></tr><tr><td>1.</td><td>${ref}</td><td><a href="/original.pdf">SYNTHETIC Operating Table</a></td><td>${date}</td></tr></table>`;
export const kcgmcTable = (
  title = "SYNTHETIC Microscope",
  link = '<a href="/Tender/ShowPDF/123">View Pdf</a>',
) =>
  `<table><tr><td>Sr. No.</td><td>Title</td><td>Opening Date</td><td>Closing Date</td><td>DETAILS</td></tr><tr><td>1.</td><td>${title}</td><td>20-Oct-2026</td><td>29-Oct-2026</td><td>${link}</td></tr></table>`;
export const healthTable = () =>
  `<table><tr><th>Sr. No.</th><th>Title</th><th>Description</th><th>Start Date</th><th>End Date</th><th>File</th></tr><tr><td>1</td><td>SYNTHETIC Laboratory notices</td><td>Reagents</td><td>20/10/2026</td><td>20/10/2027</td><td><a href="https://cdnbbsr.s3waas.gov.in/synthetic/original.pdf">View</a></td></tr></table>`;
export const ladakhPage = () =>
  `<title>Home:NHM Ladakh</title><div class="social-links"><marquee><a href="/original.pdf">SYNTHETIC Request for proposal for X-ray machine</a><a href="/recruitment.pdf">SYNTHETIC Recruitment interview candidates tender</a><a href="https://play.google.com/store/apps/details?id=synthetic">SYNTHETIC Emergency Ambulance app</a></marquee></div><footer><a href="/footer.pdf">SYNTHETIC Tender</a></footer>`;
export const skimsTable = (id = "123", next = "") =>
  `<form name="adminForm"><table><tr><td class="sectiontableheader">#</td><td class="sectiontableheader">Article Title</td><td class="sectiontableheader">Hits</td></tr><tr class="sectiontableentry1"><td>1</td><td><a href="/index.php/tenders/51-materials-management-imports/${id}-synthetic.html">SYNTHETIC Patient monitors dated 20-10-2026</a></td><td>10000</td></tr></table>${next ? `<a href="${next}">Next</a>` : ""}</form>`;

export const jkmsclTable = () =>
  `<table><tr><th>Sno</th><th>ENIT no</th><th>Type</th><th>Title</th><th>Closing Date</th><th>Link</th></tr><tr><td rowspan="2">1</td><td rowspan="2">NIT/JKMSCL/2026/716</td><td>NOTICE INVITING TENDER</td><td>SYNTHETIC Machinery and Equipments</td><td rowspan="2">14-11-2026 upto 1600 hrs</td><td><a href="/pdf/shared.pdf">View</a></td></tr><tr><td>Corrigendum</td><td>SYNTHETIC Patient monitors</td><td><a href="/pdf/amendment.pdf">View</a></td></tr></table><table><tr><td>icon</td><td><a href="/pdf/older.pdf">SYNTHETIC Older Rate Contract for Syringe Pumps</a></td></tr></table>`;
