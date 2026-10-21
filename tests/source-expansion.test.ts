import { test } from "node:test";
import assert from "node:assert/strict";
import { getSource } from "../apps/api/src/collection/registry";
import {
  parseListing,
  pageAllowed,
  noticeClassification,
} from "../apps/api/src/collection/parsers";
import { allowedNoticeDocument } from "../apps/api/src/collection/document-fetch";
import { raipur, cppp } from "./collection-fixtures";
import { bilaspur, hll, gmchEmpty } from "./source-expansion-fixtures";

test("state CPPP preserves explicit state without inventing a buyer", () => {
  const html = cppp
    .replace("Organisation Name", "State Name")
    .replace("TEST Hospital", "Punjab");
  const n = parseListing(html, getSource("cppp-states")).notices[0];
  assert.equal(n.state, "Punjab");
  assert.equal(n.buyer, null);
  assert.equal(n.portal, "state");
});
test("Bilaspur records original and extended dates without assuming a publication date", () => {
  const n = parseListing(bilaspur(), getSource("aiims-bilaspur")).notices[0];
  assert.equal(n.bidNumber, "GEM/2026/B/123456");
  assert.equal(n.closingDate, "2026-10-30");
  assert.equal(n.publishedAt, null);
  assert.equal(n.buyer, "AIIMS Bilaspur");
  assert.equal(n.state, "Himachal Pradesh");
  assert.equal(n.documents.length, 1);
});
test("Drupal next-page text is followed through its explicit pager class", () => {
  const s = getSource("aiims-bilaspur");
  const p = parseListing(
    bilaspur() +
      '<li class="pager__item--next"><a href="?page=1">Next page Next ›</a></li>',
    s,
  );
  assert.equal(p.next, s.url + "?page=1");
});
test("shared native references retain separate documents instead of dropping a notice", () => {
  const first = bilaspur("SYNTHETIC/SHARED", "one"),
    second = bilaspur("SYNTHETIC/SHARED", "two");
  const html = first.replace(
    "</table>",
    second.slice(second.indexOf("<tr><td>")),
  );
  const n = parseListing(html, getSource("aiims-bilaspur")).notices;
  assert.equal(n.length, 2);
  assert.equal(n[0].bidNumber, n[1].bidNumber);
  assert.notEqual(n[0].key, n[1].key);
});
test("HLL published path pagination is allowlisted while unrelated paths are refused", () => {
  const source = getSource("hll"),
    p = parseListing(hll, source);
  assert.equal(p.notices[0].bidNumber, "HLL/TEST/1");
  assert.equal(p.notices[0].publishedAt, null);
  assert.equal(p.notices[0].state, null);
  assert.match(p.next!, /\/index\/p\/2$/);
  assert.equal(
    pageAllowed("https://www.lifecarehll.com/tender/view/private", source),
    false,
  );
  assert.throws(
    () => parseListing(hll.replace("/tender/index/p/2", "/private"), source),
    /Unsupported pagination/,
  );
});
test("GMCH explicit empty current list succeeds without fabricating records", () =>
  assert.deepEqual(parseListing(gmchEmpty, getSource("gmch32")), {
    notices: [],
    next: null,
  }));
test("GMCH proprietary notices exclude navigation PDFs and retain unknown dates", () => {
  const html =
    '<header><a href="/policy.pdf">Unrelated policy document</a></header><main><h1>Notices for procurement of proprietary items</h1><a href="/sites/default/files/monitor.pdf">SYNTHETIC Purchase of patient monitor</a></main>';
  const p = parseListing(html, getSource("gmch32-proprietary"));
  assert.equal(p.notices.length, 1);
  assert.equal(p.notices[0].publishedAt, null);
  assert.equal(p.notices[0].bidNumber, null);
  assert.equal(p.notices[0].state, "Chandigarh");
});
test("Raipur quotation heading variation uses the same verified column layout", () =>
  assert.equal(
    parseListing(
      raipur().replace("Tender.No.", "Tender No"),
      getSource("aiims-raipur-quotations"),
    ).notices.length,
    1,
  ));
test("linked PDF downloads are limited to the collected official host", () => {
  assert.equal(
    allowedNoticeDocument(
      "https://www.aiimsbilaspur.edu.in/sites/default/files/test.pdf",
      "aiims-bilaspur",
    ),
    true,
  );
  for (const url of [
    "http://www.aiimsbilaspur.edu.in/test.pdf",
    "https://evil.example/test.pdf",
    "https://www.aiimsbilaspur.edu.in/test.pdf?redirect=https://evil.example",
    "https://user:secret@www.aiimsbilaspur.edu.in/test.pdf",
    "https://www.aiimsbilaspur.edu.in/private",
  ])
    assert.equal(allowedNoticeDocument(url, "aiims-bilaspur"), false);
});

test("specialty equipment and unknown clinical items stay discoverable", () => {
  const cbct = noticeClassification(
    "Cone Beam Computed Tomography CBCT for Craniofacial Region on Turnkey Basis",
  );
  assert.equal(cbct.medical, true);
  assert.ok(cbct.products.includes("cbct"));
  assert.equal(
    noticeClassification("Various items for Psychiatry Department").medical,
    true,
  );
});
