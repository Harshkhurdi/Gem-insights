// Synthetic procurement listings only. Never imported as real data.
export const raipur = (
  title = "Patient monitors",
  next = "",
  reference = "SYNTHETIC/RAIPUR/1",
) =>
  `<table><tr><th>S.No.</th><th>Tender.No.</th><th>Title</th><th>Publishing Date</th><th>Closing Date</th><th>Download</th><th>Corrigendum</th></tr><tr><td>1</td><td>${reference}</td><td>${title}</td><td>20-10-2026</td><td>05-11-2026</td><td><a href="../upload/tender/synthetic.pdf">Download</a></td><td><a href="../upload/tender/synthetic-corr.pdf">Corrigendum</a></td></tr></table>${next ? `<a href="${next}">Next</a>` : ""}`;
export const icmr = `<table><tr><th>Serial Number</th><th>Title</th><th>Link</th><th>Last Date</th></tr><tr><td>1</td><td>SYNTHETIC GEM/2026/B/123456 Procurement of 1 unit of CO2 Incubator</td><td><a href="/test/one.pdf">View</a><a href="/test/one.pdf">Download</a></td><td>Nov. 5, 2026</td></tr><tr><td>2</td><td>SYNTHETIC GEM/2026/B/123456 Corrigendum CO2 Incubator</td><td><a href="/test/corr.pdf">View</a></td><td>Nov. 9, 2026</td></tr></table><a rel="next" href="?page=2">Next</a>`;
export const cppp = `<table><tr><th>Sl.No</th><th>e-Published Date</th><th>Bid Submission Closing Date</th><th>Tender Opening Date</th><th>Title/Ref.No./Tender Id</th><th>Organisation Name</th></tr><tr><td>1</td><td>20-Oct-2026 09:00 PM</td><td>04-Nov-2026 05:00 PM</td><td>04-Nov-2026 06:00 PM</td><td><a href="/cppp/tendersfullview/synthetic">SYNTHETIC Supply of dialysis machines</a>/TEST/2026_TEST_12345_1</td><td>TEST Hospital</td></tr></table>`;
