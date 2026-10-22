// SYNTHETIC fixtures model observed public layouts; never baseline data.
export const rblCard = (
  reference = "GEM / 2026 / B / 123456",
  title = "SYNTHETIC Advanced USG machine",
  file = "/tender-file-download/123",
  pac = false,
) =>
  `<title>Procurements | AIIMS Raebareli</title><div class="card-body"><h4>1- ${pac ? "Tender id:" : "Ref./Adv. Number:"} ${reference}</h4><div class="item7-card-desc"><a>${pac ? "Objection Submission Start Date:" : "Date of Publishing:"} 17-10-2026</a> <a>${pac ? "Objection Submission End Date:" : "Date of Closing:"} 30-10-2026</a></div><p>${pac ? "<b>Name of Manufacturer:</b>" : ""}${title}</p>${file ? `<a href="${file}">Download</a>` : ""}</div>`;
export const gkpRow = (
  title = "SYNTHETIC Patient monitors",
  file = "/wp-content/uploads/original.pdf",
  label = "Original",
) =>
  `<tr><td><div class="blog_ref"><h4>${title}</h4><a href="${file}">${label}</a></div></td><td><span style="display:none">20261017</span><b>17-Oct-2026</b></td><td><span style="display:none">20261030</span><b>30-Oct-2026</b></td></tr>`;
export const gkpTable = (rows = gkpRow()) =>
  `<table class="display"><thead><tr><th>Title</th><th>Start Date</th><th>End Date</th></tr></thead><tbody>${rows}</tbody></table>`;
export const healthEmpty = `<title>Tenders | Health | India</title><h1>Tenders</h1><div id="no-results-message">Sorry, no notice matched this category.</div>`;
