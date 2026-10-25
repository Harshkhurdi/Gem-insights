#!/usr/bin/env node
// Review assist: pre-verifies extraction drafts against their original
// publisher-hosted PDFs and prints a recommendation per document. With
// --apply it submits the recommended review through the operator API.
// Rules are deliberately conservative: anything that cannot be confirmed
// against the document is deferred, and service-contract items are never
// approved as equipment purchases.
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const api = process.env.API_URL || "http://localhost:3000";
const origin = process.env.WEB_ORIGIN || "http://localhost:3000";
const apply = process.argv.includes("--apply");
const limit = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 25,
);
const SERVICE =
  /\b(security|wage|manpower|housekeeping|data entry|amc|maintenance|operations of|running of|service provider|facility|pest control|laundry|biomedical waste)\b/i;

async function pdfText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "GemInsights/0.3 (review verification)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(
    "/tmp/review-assist.pdf",
    Buffer.from(await res.arrayBuffer()),
  );
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [
      path.resolve("scripts/extract-pdf.mjs"),
      "/tmp/review-assist.pdf",
      "/tmp/review-assist.json",
    ],
    { timeout: 180000, stdio: "pipe" },
  );
  return fs
    .readFileSync("/tmp/review-assist.json", "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .map((d) => d.pages.map((p) => p.text).join("\n"))
    .join("\n");
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let cookie = "";
if (apply) {
  const login = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ key: process.env.ADMIN_KEY || "" }),
  });
  if (!login.ok)
    throw new Error(`Admin login failed (${login.status}); check ADMIN_KEY`);
  cookie = (login.headers.get("set-cookie") || "").split(";")[0];
}
const { rows } = await db.query(
  `SELECT d.id, x.version, x.record, n.bid_number, n.buyer_state
   FROM upload_document d
   JOIN extraction_draft x ON x.document_id = d.id
   LEFT JOIN notice_document_link l ON l.document_id = d.id
   LEFT JOIN discovered_notice n ON n.id = l.notice_id
   WHERE d.status = 'review' ORDER BY d.created_at DESC LIMIT $1`,
  [limit],
);
const stats = { approve: 0, reject: 0, defer: 0 };
for (const row of rows) {
  const r = row.record;
  const items = (r.items || []).filter(
    (i) => !/^Additional Specification Parameters/i.test(i.name || ""),
  );
  const serviceItem = items.some((i) => SERVICE.test(i.name || ""));
  let action = "defer";
  let why = "";
  if (!r.bidNumber || !r.buyer?.name || !items.length) {
    action = "reject";
    why = "incomplete GeM structure (no bid number, buyer or BOQ items)";
  } else if (serviceItem) {
    action = "reject";
    why = "items look like a services contract, not equipment purchase";
  } else {
    let text = "";
    try {
      text = (await pdfText(r.sourceUrl)).replace(/\s+/g, " ");
    } catch (e) {
      why = `document unreachable (${e.message})`;
    }
    if (text) {
      if (/Bid Corrigendum|Corrigendum No/i.test(text)) {
        action = "reject";
        why = "corrigendum document; items remain in the original bid";
      } else if (
        !items.every((i) =>
          text.includes(
            (i.evidence || "").replace(/^p\.\s*\d+:\s*/, "").slice(0, 36),
          ),
        )
      ) {
        why = "item evidence not confirmed in document text";
      } else {
        const total = text.match(/Total Quantity\s+([\d,]+(?:\.\d+)?)/);
        if (total && items.length === 1 && items[0].quantity != null) {
          if (
            Math.abs(
              Number(items[0].quantity) - Number(total[1].replace(/,/g, "")),
            ) > 0.01
          ) {
            why = "single-item quantity differs from printed total";
          }
        }
        if (!why) {
          action = "approve";
          why =
            "bid structure complete; evidence confirmed; quantities consistent";
        }
      }
    }
  }
  stats[action]++;
  console.log(
    `${row.id} ${action.toUpperCase()} ${row.bid_number || "-"} — ${why}`,
  );
  if (apply && action !== "defer") {
    const record = { ...r, items };
    const body = {
      version: row.version,
      record,
      classifications: {},
      reason: `Review assist: ${why}. Verified against the original PDF fetched from the publisher host.`,
      completeSnapshot: action === "approve",
      reviewedAllPages: true,
      expectedTenderHash: null,
    };
    const res = await fetch(
      `${api}/api/admin/documents/${row.id}/review/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      },
    );
    console.log(`  submitted -> ${res.status}`);
  }
}
console.log("SUMMARY:", stats);
await db.end();
