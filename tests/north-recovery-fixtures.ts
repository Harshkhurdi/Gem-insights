// SYNTHETIC fixtures model observed public layouts; never baseline data.
export const jodhpurRow = (
  reference = "GEM/2026/B/8077851",
  title = "SYNTHETIC Piezosurgery Unit",
  file = "tender/2026/10/original.pdf",
  start = "16-10-2026",
  end = "16-11-2026",
) =>
  `<tr><td>${reference}</td><td>${title}<br><a href='${file}' target='_blank'>View Document</a></td><td class='date-column'>${start}</td><td class='date-column'>${end}</td><td></td></tr>`;
export const jodhpurTable = (rows = jodhpurRow()) =>
  `<table class="table table-bordered table-striped"><thead class="table-dark"><tr><th>Tender Reference</th><th>Tender Subject / Tender Document</th><th class="date-column">Start Date</th><th class="date-column">End Date</th><th>Remarks / Documents</th></tr></thead><tbody style="background-color: #fff;">${rows}</tbody></table>`;
export const sgpgimsRow = (
  description = "SYNTHETIC Supply of Patient Monitors for ICU",
  file = "../Home/Tender/2026/original.pdf",
) =>
  `<tr><td style="vertical-align: middle;">1</td><td style="vertical-align: middle;">${description}</td><td style="vertical-align: middle;"><a href="${file}">Download</a></td></tr>`;
export const sgpgimsTable = (rows = sgpgimsRow()) =>
  `<table class="serial table table-bordered table-striped" width="100%"><thead><tr><th width="13%">S. No.</th><th width="2%">Description</th><th width="85%">View / Download</th></tr></thead><tbody>${rows}</tbody></table>`;
export const phscCurrentRow = (
  bid = "PHSC/ Proc/ 2026/ Quotation-EDL Medicine/ 69",
  subject = "PHSC invites sealed quotations",
  file = "/sites/default/files/2026-10/notice.doc",
  start = "09-Oct-2026",
  end = "11-Oct-2026",
) =>
  `<tr><td>${start}</td><td>1</td><td>${bid}</td><td>${end}</td><td><a href="${file}" target="_blank">${subject}</a>(<strong>Format:</strong> DOC , <strong>Size: </strong> 440 KB, )</td></tr>`;
export const phscCurrentTable = (rows = phscCurrentRow()) =>
  `<table><thead><tr><th>Start Date</th><th>S. No.</th><th>BID No</th><th>End Date</th><th>Subject of Tender</th></tr></thead><tbody>${rows}</tbody></table>`;
export const phscArchiveRow = (
  bid = "PHSC/Proc/Antibiotic Discs",
  subject = "SYNTHETIC RATE CONTRACT TENDER DOCUMENT: Antibiotic discs, reagents and culture media",
  file = "/sites/default/files/2017-07/original.pdf",
) =>
  `<tr><td>1</td><td>19-Jun-2017</td><td>10-Jul-2017</td><td>${bid}</td><td><a href="${file}" target="_blank">${subject}</a>(<strong>Format:</strong> DOC, <strong>Size:</strong> 782.45 KB, <strong>Language:</strong> English)</td></tr>`;
export const phscArchiveTable = (rows = phscArchiveRow()) =>
  `<table><thead><tr><th>S. No.</th><th>Start Date</th><th>End Date</th><th>BID No</th><th>Subject of Tender</th></tr></thead><tbody>${rows}</tbody></table>`;
export const hmsclRow = (
  reference = "HMSCL/EQ/2026/01",
  title = "SYNTHETIC Supply of ICU Ventilators",
  file = "/Content/tenders/2026/original.pdf",
) =>
  `<tr><td>1</td><td>${reference}</td><td>${title}</td><td>Published: 20-10-2026</td><td>Open</td><td><a href="${file}">Tender Document</a></td><td><a href="/Content/tenders/2026/corrigendum.pdf">Corrigendum</a></td></tr>`;
export const hmsclTable = (rows = hmsclRow()) =>
  `<table><thead><tr><th>No.</th><th>Tender / Reference</th><th>Title / Description</th><th>Important Dates</th><th>Status</th><th>Tender Documents</th><th>Corrigendum / Updates</th></tr></thead><tbody>${rows}</tbody></table>`;
export const hmsclEmpty = `<table><thead><tr><th>No.</th><th>Tender / Reference</th><th>Title / Description</th><th>Important Dates</th><th>Status</th><th>Tender Documents</th><th>Corrigendum / Updates</th></tr></thead><tbody><tr><td colspan="7">No published tenders match these filters. Try another title or category.</td></tr></tbody></table>`;
