import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseListing,
  pageAllowed,
  noticeClassification,
  noticeKey,
} from "../apps/api/src/collection/parsers";
import { getSource } from "../apps/api/src/collection/registry";
import { allowedNoticeDocument } from "../apps/api/src/collection/document-fetch";
const source = getSource("aiims-rishikesh");
const head =
  "<tr><th>Tender Reference</th><th>Download Tender Document</th><th>Start Date</th><th>Last Date</th><th>Related Links</th></tr>";
const row = (
  ref = "GEM/2026/B/123456",
  title = "SYNTHETIC ELISA kits",
  primary = "/original.pdf",
  related = '<a href="/amendment.pdf">Corrigendum</a><a href="/boq.xls">BOQ</a>',
) =>
  `<tr><td>${ref}</td><td>${primary ? `<a href="${primary}">${title}</a>` : title}</td><td>20-10-2026</td><td>05-11-2026</td><td>${related}</td></tr>`;
const table = (body = row()) => `<table>${head}${body}</table>`;
const box = (
  title = "SYNTHETIC Price bid opening summary: MRI",
  file = "summary.pdf",
) =>
  `<div class="list-box"><div class="media1"><h6>Equipment Division</h6><p>${title}</p></div><a href="/KMSCL/uploads/${file}">Download</a></div>`;
const notices = (body = box()) =>
  `<header><a href="/policy.pdf">Policy</a></header><main id="main"><h1>Notices</h1>${body}</main>`;
test("Rishikesh retains native references, dates, original/amendment PDFs and Excel BOQs", () => {
  const n = parseListing(table(), source).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.portal, "gem");
  assert.equal(n.buyer, "AIIMS Rishikesh");
  assert.equal(n.state, "Uttarakhand");
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, "2026-11-05");
  assert.equal(n.documents.length, 3);
  assert.match(n.documents[2], /boq.xls$/);
  assert.equal("quantity" in n, false);
  assert.equal(allowedNoticeDocument(n.documents[2], source.id), false);
});
test("quotation downloads in Related Links retain the quotation title", () => {
  const html = table(
    row(
      "SYNTHETIC/QUOTE/1",
      "SYNTHETIC Reagents",
      "",
      '<a href="/quote.docx">Download</a>',
    ),
  ).replaceAll("Tender", "Quotation");
  const n = parseListing(html, getSource("aiims-rishikesh-quotations"))
    .notices[0];
  assert.equal(n.title, "SYNTHETIC Reagents");
  assert.match(n.url, /quote.docx$/);
  assert.equal(n.portal, "institution");
});
test("broken archive originals remain separate listing rows with repeatable restore identities", () => {
  const s = getSource("aiims-rishikesh-archive");
  const p = parseListing(
    table(
      row(
        "SYNTHETIC/SHARED",
        "SYNTHETIC Reagents",
        "http://BrokenOriginal",
        "",
      ) + row("SYNTHETIC/SHARED", "SYNTHETIC Catheters", "", ""),
    ),
    s,
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  for (const n of p.notices) {
    assert.equal(n.url, s.url);
    assert.equal(n.documents.length, 0);
    assert.equal(n.key, noticeKey(s, n.bidNumber, n.url, n.title));
  }
});
test("nested amendment tables are attachments rather than additional tenders", () => {
  const nested =
    "<table>" +
    row("SYNTHETIC/NESTED", "SYNTHETIC nested description", "/nested.pdf", "") +
    "</table>";
  const p = parseListing(
    table(
      row("SYNTHETIC/MAIN", "SYNTHETIC Patient monitors", "/main.pdf", nested),
    ),
    source,
  );
  assert.equal(p.notices.length, 1);
  assert.equal(p.notices[0].bidNumber, "SYNTHETIC/MAIN");
  assert.ok(p.notices[0].documents.some((u) => u.endsWith("/nested.pdf")));
});
test("Rishikesh pagination cannot silently switch to another WordPress content page", () => {
  assert.equal(pageAllowed(source.url + "&paged=2", source), true);
  assert.equal(
    pageAllowed(getSource("aiims-rishikesh-archive").url, source),
    false,
  );
  assert.throws(
    () =>
      parseListing(
        table() + '<a rel="next" href="?page_id=2529">Next</a>',
        source,
      ),
    /Unsupported pagination/,
  );
});
test("published external amendment pointers remain review links without automatic downloads", () => {
  const p = parseListing(
    table(
      row(
        "SYNTHETIC/ONE",
        "SYNTHETIC Patient monitors",
        "/one.pdf",
        '<a href="https://drive.google.com/file/d/SYNTHETIC/view">Technical corrigendum</a><a href="http://BrokenExtension">Bad link</a>',
      ),
    ),
    source,
  );
  assert.equal(p.notices[0].documents.length, 2);
  const external = p.notices[0].documents[1];
  assert.match(external, /drive.google.com/);
  assert.equal(allowedNoticeDocument(external, source.id), false);
});
test("KMSCL uses notice-specific titles and keeps price-opening status explicit with unknown dates", () => {
  const n = parseListing(notices(), getSource("kmscl")).notices[0];
  assert.match(n.title, /Price bid opening/);
  assert.equal(n.bidNumber, null);
  assert.equal(n.publishedAt, null);
  assert.equal(n.closingDate, null);
  assert.equal(n.state, "Kerala");
  assert.equal(n.documents.length, 1);
  assert.equal(n.portal, "institution");
});
test("KMSCL separates notices sharing a description and retains Word attachments", () => {
  const p = parseListing(
    notices(
      box("SYNTHETIC Procurement notice", "one.pdf") +
        box("SYNTHETIC Procurement notice", "two.docx"),
    ),
    getSource("kmscl"),
  );
  assert.equal(p.notices.length, 2);
  assert.notEqual(p.notices[0].key, p.notices[1].key);
  assert.match(p.notices[1].documents[0], /docx$/);
});
test("KMSCL layout changes or empty content fail instead of reporting successful coverage", () => {
  for (const html of [
    notices(""),
    notices(box().replace("media1", "changed")),
    notices().replace("<h1>Notices</h1>", "<h1>Tenders</h1>"),
  ])
    assert.throws(() => parseListing(html, getSource("kmscl")), /KMSCL/);
});
test("medical consumables and reagents remain review candidates without becoming equipment demand", () => {
  for (const title of [
    "ELISA kits",
    "Supply of reagents",
    "Sutures",
    "Nasogastric tubes",
    "Pharmaceutical drugs",
    "Endotracheal Tubes",
  ]) {
    const c = noticeClassification(title);
    assert.equal(c.medical, true, title);
    assert.deepEqual(c.products, [], title);
    assert.match(c.reason, /verify/i);
  }
  assert.equal(
    noticeClassification("Supply of office stationery").medical,
    false,
  );
});
