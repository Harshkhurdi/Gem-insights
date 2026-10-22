// Synthetic HTML that follows the independently inspected public table layouts.
export const delhiTable = (
  title = "SYNTHETIC Patient monitors",
  id = "12345",
  archive = false,
  next = "",
) => `<table><tr><th>S. No.</th>${archive ? "" : "<th>Tender Category</th>"}<th>${archive ? "Title" : "Tender Title"}</th><th>${archive ? "Opening Date" : "Date of Publishing"}</th><th>${archive ? "Closing Date" : "Date of Closing"}</th></tr>
<tr><td>1</td>${archive ? "" : "<td>Global/Open Tender</td>"}<td><a href="/index.php/en/tenders${archive ? "/archive-tender/global-open-tender?view=expire&amp;id=" + id + ":synthetic&amp;catid=133" : "?id=" + id}">${title}</a></td><td>20-10-2026</td><td>05-11-2026</td></tr></table>${next ? `<a rel="next" href="${next}">Next</a>` : ""}`;

export const bathindaRow = (
  ref = "GEM/2026/B/123456",
  title = "SYNTHETIC Patient monitors",
  links = '<a href="/images/corrigendum.pdf">Corrigendum 2</a><a href="/images/original.pdf">GeM Bid Document</a><a href="/images/boq.xlsx">BOQ</a>',
) =>
  `<tr><td>1</td><td>${ref}</td><td>${title}</td><td>20-Oct-2026</td><td>05-Nov-2026</td><td>${links}</td></tr>`;
export const bathindaTable = (rows = bathindaRow()) =>
  `<table><tr><th>#</th><th>Tender Ref.</th><th>Title</th><th>Start Date</th><th>End Date</th><th>Related Links</th></tr>${rows}</table>`;
