// Synthetic examples of independently inspected public table layouts.
export const rmscRow = (
  name = "SYNTHETIC NIB-110",
  description = "Supply of Microscopes",
  article = "notice-110.html",
  documents = '<a href="/files/original.pdf">Original</a><a href="/files/corrigendum.pdf">Corrigendum</a><a href="/files/boq.xlsx">BOQ</a>',
) =>
  `<tr><td><a href="${article}">${name}</a></td><td>Wed Feb 03 13:30:00 IST 2016</td><td>Wed Mar 09 13:30:00 IST 2016</td><td>${description}</td><td>${documents}</td><td>Wed Oct 11 11:58:06 IST 2023</td></tr>`;
export const rmscTable = (rows = rmscRow()) =>
  `<table><tr><th>Name</th><th>From</th><th>To</th><th>Description</th><th>Files</th><th>Upload Date</th></tr>${rows}</table>`;
export const upumsTable = (
  title = "SYNTHETIC Patient monitors",
  document = "/files/upums.pdf",
  date = "20/10/2026",
) =>
  `<table><tr><th>SN.</th><th>Title</th><th>Published Date</th><th>Details</th></tr><tr><td>1</td><td>${title}</td><td>${date}</td><td>${document ? `<a href="${document}">Click Here</a>` : ""}</td></tr></table>`;
